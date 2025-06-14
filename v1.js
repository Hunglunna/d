// === CONFIGURATION ===
const TOKEN = '8017791851:AAEBpRUQwoY4-FHHJRM-f7baYgdo6hpDwaw';
const SHEET_ID = '1YER6PexGeD-2NlTS0JyHj-9yiukDdEqQC-WVcZ8-kh8';
const SHEET_NAME_USERS = 'users';
const SHEET_NAME_ATTENDANCE = 'attendance';
const SHEET_NAME_SCHEDULE = 'schedule';
const SHEET_NAME_REMARKS = 'remarks';
const SHEET_NAME_LOCATION = 'checkin_location'; // Sheet để lưu lịch sử vị trí

// === SHIFT DEFINITIONS ===
const SHIFT_DEFINITIONS = {
  '1': { start: '06:00', end: '14:00' },
  '2': { start: '14:00', end: '22:00' },
  'TS': hours => ({ start: '06:00', end: addHoursToTime('06:00', hours) }),
  'TT': hours => ({ start: subtractHoursFromTime('22:00', hours), end: '22:00' }),
};

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (!data.message) return;

    const msg = data.message;
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const firstName = msg.from.first_name || '';
    const text = msg.text ? msg.text.trim() : '';
    const location = msg.location;

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheetUsers = ss.getSheetByName(SHEET_NAME_USERS);
    const userInfo = getUserInfo(sheetUsers, userId);

    // === ADMIN COMMANDS ===
    if (text === '/help') {
      let helpText = `*HƯỚNG DẪN SỬ DỤNG BOT CHẤM CÔNG*\n\n` +
        `Các lệnh cơ bản cho người dùng:\n` +
        '/start - Bắt đầu sử dụng bot\n' +
        '/checkin - Điểm danh (checkin)\n' +
        '/checkout - Kết thúc ca làm (checkout)\n' +
        '/today - Xem ca hôm nay\n' +
        '/tomorrow - Xem ca ngày mai\n' +
        '/viewremarks - Xem nhận xét từ admin\n\n';
      if (userInfo?.isAdmin) {
        helpText += `*Lệnh cho admin:*\n` +
          '/setlocation - Cài đặt vị trí chấm công\n' +
          '/schedule <tên> <ca> | ... - Lên lịch ca cho nhân viên\n' +
          '/viewlogs - Xem logs chấm công hôm nay\n' +
          '/viewschedule <dd> - Xem lịch phân ca ngày dd\n' +
          '/remark <ten> <nội dung> trong ngoặc kép - Gửi nhận xét cho nhân viên\n' +
          '/manageusers - Quản lý nhân viên\n';
      }
      sendMessage(chatId, helpText);
      return;
    }

    // === ADMIN SET LOCATION ===
    if (text === '/setlocation' && userInfo?.isAdmin) {
      PropertiesService.getScriptProperties().setProperty(`WAITING_ADMIN_LOCATION_${userId}`, 'true');
      sendMessage(chatId, `📍 Vui lòng gửi vị trí để thiết lập geo-fence.`);
      return;
    }

    if (
      location &&
      PropertiesService.getScriptProperties().getProperty(`WAITING_ADMIN_LOCATION_${userId}`) === 'true' &&
      userInfo?.isAdmin
    ) {
      PropertiesService.getScriptProperties().deleteProperty(`WAITING_ADMIN_LOCATION_${userId}`);
      PropertiesService.getScriptProperties().setProperty('CHECKIN_LAT', location.latitude.toString());
      PropertiesService.getScriptProperties().setProperty('CHECKIN_LON', location.longitude.toString());
      // Lưu vào sheet lịch sử vị trí
      getOrCreateSheet(SHEET_NAME_LOCATION).appendRow([
        new Date(),
        userId,
        userInfo.name || '',
        location.latitude,
        location.longitude
      ]);
      sendMessage(chatId, `✅ Đã lưu điểm chấm công tại [${location.latitude}, ${location.longitude}]`);
      return;
    }

    // --- Lên lịch ca cho nhân viên: lưu tên thay vì UserID ---
    if (text.startsWith('/schedule') && userInfo?.isAdmin) {
      const entries = text.slice(9).split('|').map(s => s.trim());
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const scheduleSheet = getOrCreateSheet(SHEET_NAME_SCHEDULE);

      entries.forEach(entry => {
        const parts = entry.split(' ').filter(p => p);
        if (parts.length < 2) return;
        const name = parts[0];
        let shiftRaw = parts[1];
        let shiftCode = shiftRaw;
        let m = shiftRaw.match(/^(\d+)(TS|TT)$/i);
        if (m) shiftCode = m[2].toUpperCase() + m[1];
        else {
          m = shiftRaw.match(/^(TS|TT)(\d+)$/i);
          if (m) shiftCode = m[1].toUpperCase() + m[2];
        }
        const key = shiftCode.match(/^(\d+|TS|TT)/)[0];
        if (!SHIFT_DEFINITIONS[key] && !/^\d+-\d+$/.test(shiftRaw)) {
          sendMessage(chatId, `⚠️ Ca "${shiftRaw}" không hợp lệ.`);
          return;
        }
        // Kiểm tra tồn tại user trong sheet users
        const realName = findUserNameByName(sheetUsers, name);
        if (!realName) {
          sendMessage(chatId, `⚠️ Không tìm thấy nhân viên tên "${name}".`);
          return;
        }
        const dateObj = new Date(year, now.getMonth(), now.getDate() + 1);
        const day = String(dateObj.getDate()).padStart(2, '0');
        const dateStr = `${day}-${month}-${year}`;
        scheduleSheet.appendRow([realName, dateStr, shiftCode]); // Lưu real name
        sendMessage(chatId, `✅ Thêm ca cho ${realName} ngày mai (${dateStr}): ${shiftCode}`);
      });
      return;
    }

    if (text === '/viewremarks') {
  // Lấy userId từ dữ liệu Telegram (thường là msg.from.id)
  const userName = getUserNameById(userId);
  if (!userName) {
    sendMessage(chatId, '⚠️ Bạn chưa đăng ký tài khoản!');
    return;
  }
  const remarks = getRemarksByName(userName);
  if (remarks.length === 0) {
    sendMessage(chatId, `Bạn chưa có nhận xét nào.`);
    return;
  }
  let reply = `📋 Nhận xét của bạn:\n`;
  remarks.forEach((row, idx) => {
    // row[1]: Time, row[2]: Remark
    const d = new Date(row[1]);
    const timeStr = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} ${d.getHours()}:${d.getMinutes().toString().padStart(2,"0")}`;
    reply += `\n${idx+1}. [${timeStr}] ${row[2]}`;
  });
  sendMessage(chatId, reply);
}

    if (text === '/today') {
      checkScheduleForUser(userId, chatId, 0, 'Hôm nay');
      return;
      }
    if (text === '/tomorrow') {
      checkScheduleForUser(userId, chatId, 1, 'Ngày mai');
      return;
      }

    if (text === '/viewlogs' && userInfo?.isAdmin) {
      sendMessage(chatId, readTodayLogs());
      return;
    }

    if (text.startsWith('/viewschedule') && userInfo?.isAdmin) {
  const parts = text.trim().split(' ');
  const day = parts[1] ? parts[1].padStart(2, '0') : null;
  if (!day) {
    sendMessage(chatId, `⚠️ Vui lòng nhập ngày (dd). Ví dụ: /viewschedule 14`);
    return;
  }
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const date = `${day}-${month}-${year}`;
  const result = readScheduleForDate(date);
  sendMessage(chatId, result);
  return;
}



    

   

    if (text.startsWith('/remark ')) {
  // Loại bỏ /remark, lấy phần còn lại
  const cmd = text.replace('/remark ', '').trim();

  // Tìm dấu cách đầu tiên, sau đó tìm dấu " đầu tiên và cuối cùng
  // hoặc dùng regex cho tiện
  const match = cmd.match(/^([^\s]+)\s+"(.+)"$/);
  if (!match) {
    sendMessage(chatId, '⚠️ Định dạng đúng: /remark ten "nội dung nhận xét"');
    return;
  }
  const name = match[1];
  const remarkText = match[2];

  saveRemarkByName(name, remarkText);
  sendMessage(chatId, '✅ Đã lưu nhận xét.');
}

    if (text === '/manageusers' && userInfo?.isAdmin) {
      sendMessage(chatId, listUsers());
      return;
    }

    // === USER COMMANDS ===
    if (text === '/start') {
      handleStart(sheetUsers, chatId, userId, firstName);
      return;
    }
    if (text === '/checkin') {
      PropertiesService.getScriptProperties().setProperty(`WAITING_CHECKIN_${userId}`, 'true');
      requestLocation(chatId);
      return;
    }
    if (text === '/checkout') {
      handleCheckout(chatId, userId);
      return;
    }
    

    // Name registration
    if (PropertiesService.getScriptProperties().getProperty(`WAITING_NAME_${userId}`) === 'true') {
      registerName(sheetUsers, chatId, userId, text.trim());
      return;
    }

    // Handle check-in location cho user
    if (location) {
      handleLocation(chatId, userId, firstName, location);
      return;
    }
  } catch (error) {
    Logger.log('Error in doPost: ' + error);
  }
}

// --- HELPER FUNCTIONS ---
function handleStart(sheet, chatId, userId, firstName) {
  const info = getUserInfo(sheet, userId);
  if (info) {
    sendMessage(chatId, `👋 Xin chào ${info.isAdmin ? 'admin' : 'nv'} ${info.name}`);
  } else {
    const isAdmin = checkIfAdmin(userId);
    if (isAdmin) {
      sheet.appendRow([userId, firstName, 'admin']);
      sendMessage(chatId, `👋 Chào admin`);
    } else {
      PropertiesService.getScriptProperties().setProperty(`WAITING_NAME_${userId}`, 'true');
      sendMessage(chatId, `📛 Nhập họ tên:`);
    }
  }
}
function getUserNameById(uid) {
  const usersSheet = getOrCreateSheet(SHEET_NAME_USERS);
  const usersData = usersSheet.getDataRange().getValues();
  for (let i = 1; i < usersData.length; i++) {
    if (String(usersData[i][0]).trim() === String(uid).trim()) {
      return String(usersData[i][1]).trim();
    }
  }
  return null;
}

// Hàm lấy tất cả remark theo tên
function getRemarksByName(name) {
  const remarksSheet = getOrCreateSheet(SHEET_NAME_REMARKS);
  const remarksData = remarksSheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < remarksData.length; i++) { // Bỏ dòng header
    if (String(remarksData[i][0]).trim().toLowerCase() === name.trim().toLowerCase()) {
      result.push(remarksData[i]);
    }
  }
  return result;
}
function readScheduleForDate(dateStr) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('schedule');
  const data = sheet.getDataRange().getValues();
  let result = `📅 Lịch làm việc ngày ${dateStr}:\n`;
  let found = false;
  for (let i = 1; i < data.length; i++) {
    // Cột 0: Tên, cột 1: Ngày, cột 2: Ca
    const scheduleDate = formatSheetDate(data[i][1]);
    if (scheduleDate === dateStr) {
      result += `- ${data[i][0]}: ${data[i][2]}\n`;
      found = true;
    }
  }
  if (!found) result += 'Không có ai làm ca trong ngày này.';
  return result.trim();
}

/**
 * Hàm phụ trợ định dạng ngày sheet schedule
 */
function formatSheetDate(dateValue) {
  if (dateValue instanceof Date && !isNaN(dateValue)) {
    const day = String(dateValue.getDate()).padStart(2, '0');
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const year = dateValue.getFullYear();
    return `${day}-${month}-${year}`;
  } else if (typeof dateValue === "number") {
    const date = new Date(Math.round((dateValue - 25569) * 86400 * 1000));
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } else {
    return String(dateValue || '').trim();
  }
}
function registerName(sheet, chatId, userId, name) {
  if (name.length < 3) {
    sendMessage(chatId, `⚠️ Tên >=3 ký tự`);
    return;
  }
  sheet.appendRow([userId, name, 'user']);
  PropertiesService.getScriptProperties().deleteProperty(`WAITING_NAME_${userId}`);
  sendMessage(chatId, `✅ Đã lưu tên ${name}`);
}

function handleCheckout(chatId, userId) {
  const sheet = getOrCreateSheet(SHEET_NAME_ATTENDANCE);
  const data = sheet.getDataRange().getValues();
  const t = new Date().toDateString();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(userId) && new Date(data[i][2]).toDateString() === t) {
      const f = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm:ss');
      sheet.getRange(i + 1, 7).setValue(f);
      sendMessage(chatId, `✅ Checkout ${f}`);
      return;
    }
  }
  sendMessage(chatId, `⚠️ Chưa checkin.`);
}

// fix: tên lấy đúng từ sheet users
function handleLocation(chatId, userId, firstName, loc) {
  const props = PropertiesService.getScriptProperties();
  const waiting = props.getProperty(`WAITING_CHECKIN_${userId}`);
  if (waiting === 'true') {
    props.deleteProperty(`WAITING_CHECKIN_${userId}`);

    const cLatStr = props.getProperty('CHECKIN_LAT');
    const cLonStr = props.getProperty('CHECKIN_LON');
    if (!cLatStr || !cLonStr) {
      sendMessage(chatId, `⚠️ Hệ thống chưa được admin cài đặt vị trí chấm công. Vui lòng báo admin dùng /setlocation!`);
      return;
    }

    const cLat = parseFloat(cLatStr);
    const cLon = parseFloat(cLonStr);
    const lat = loc.latitude, lon = loc.longitude;
    const dist = getDistanceInMeters(lat, lon, cLat, cLon);

    if (dist > 100) {
      sendMessage(chatId, `⚠️ Bạn cách điểm chấm công ${Math.round(dist)}m (quy định <=100m)`);
      return;
    }
    // Lấy tên thật từ sheet users
    const usersSheet = getOrCreateSheet(SHEET_NAME_USERS);
    const userInfo = getUserInfo(usersSheet, userId);
    const trueName = userInfo ? userInfo.name : firstName;

    const f = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm:ss');
    getOrCreateSheet(SHEET_NAME_ATTENDANCE).appendRow([
      userId, trueName, new Date(), lat, lon, Math.round(dist), ''
    ]);
    sendMessage(chatId, `✅ Checkin thành công lúc ${f}`);
  }
}



function readTodayLogs() {
  const data = getOrCreateSheet(SHEET_NAME_ATTENDANCE).getDataRange().getValues();
  const t = new Date().toDateString();
  let out = 'Logs hôm nay:\n';
  data.forEach(r => {
    if (new Date(r[2]).toDateString() === t)
      out += `${r[0]}-${r[1]} in ${Utilities.formatDate(new Date(r[2]), Session.getScriptTimeZone(), 'HH:mm:ss')} out ${r[6] || 'N/A'}\n`;
  });
  return out;
}

function readSchedule(date) {
  const data = getOrCreateSheet(SHEET_NAME_SCHEDULE).getDataRange().getValues();
  let out = `Lịch ${date}:\n`;
  data.forEach(r => {
    if (r[1] === date) out += `${r[0]}: ${r[2]}\n`;
  });
  return out;
}
/**
 * Lấy tên người dùng theo userId từ sheet 'users'
 */
function getUserNameById(userId) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('users');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(userId).trim()) {
      return String(data[i][1] || '').replace(/\s+/g, ' ').trim();
    }
  }
  return '';
}

/**
 * Định dạng ngày về dạng dd-mm-yyyy (dù đầu vào là Date, number, hay string)
 */
function formatSheetDate(dateValue) {
  if (dateValue instanceof Date && !isNaN(dateValue)) {
    // Trường hợp là Date object
    const day = String(dateValue.getDate()).padStart(2, '0');
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const year = dateValue.getFullYear();
    return `${day}-${month}-${year}`;
  } else if (typeof dateValue === "number") {
    // Trường hợp là số serial của Google Sheets
    const date = new Date(Math.round((dateValue - 25569) * 86400 * 1000)); // 25569 là số ngày từ 01/01/1900 đến 01/01/1970
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } else {
    // Trường hợp là string
    return String(dateValue || '').trim();
  }
}

/**
 * Kiểm tra ca cho userId vào ngày offsetDay (0=hôm nay, 1=ngày mai)
 */
function checkScheduleForUser(userId, chatId, offsetDay, label) {
  try {
    // Tính ngày cần kiểm tra
    const dateObj = new Date();
    dateObj.setDate(dateObj.getDate() + (offsetDay || 0));
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const dateStr = `${day}-${month}-${year}`;

    // Lấy tên người dùng
    const name = getUserNameById(userId);
    if (!name) {
      sendMessage(chatId, `⚠️ Bạn chưa đăng ký tên.`);
      return;
    }

    // Lấy dữ liệu lịch làm
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('schedule');
    const data = sheet.getDataRange().getValues();
    let found = false;
    for (let i = 1; i < data.length; i++) {
      const scheduleName = String(data[i][0] || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const userName = name.toLowerCase();
      const scheduleDate = formatSheetDate(data[i][1]);
      if (scheduleName === userName && scheduleDate === dateStr) {
        sendMessage(chatId, `📅 ${label} bạn có ca: ${data[i][2]}`);
        found = true;
        break;
      }
    }
    if (!found) {
      sendMessage(chatId, `📭 ${label} bạn không có ca.`);
    }
  } catch (err) {
    sendMessage(chatId, `Lỗi: ${err}`);
  }
}





function saveRemarkByName(name, text) {
  // Kiểm tra tên có trong sheet users không (cột 2, bỏ qua hoa thường, khoảng trắng thừa)
  const usersSheet = getOrCreateSheet(SHEET_NAME_USERS);
  const usersData = usersSheet.getDataRange().getValues();
  let found = false;
  for (let i = 1; i < usersData.length; i++) {
    if (String(usersData[i][1]).trim().toLowerCase() === name.trim().toLowerCase()) {
      found = true;
      break;
    }
  }
  if (found) {
    getOrCreateSheet(SHEET_NAME_REMARKS).appendRow([name.trim(), new Date(), text]);
  } else {
    Logger.log("Tên không tồn tại trong danh sách user!");
  }
}

function listUsers() {
  return getOrCreateSheet(SHEET_NAME_USERS).getDataRange().getValues().slice(1)
    .map(r => `${r[0]}-${r[1]}(${r[2]})`).join('\n');
}

function parseTime(s) {
  const [h, m] = s.split(':').map(Number);
  return new Date(0, 0, 0, h, m);
}

// Tìm đúng tên từ sheet users (case-insensitive)
function findUserNameByName(sheet, name) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++)
    if ((data[i][1] || '').toLowerCase().trim() === name.toLowerCase().trim())
      return data[i][1];
  return null;
}

function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (name === SHEET_NAME_SCHEDULE) sh.appendRow(['Name', 'Date', 'Shift']);
    if (name === SHEET_NAME_ATTENDANCE) sh.appendRow(['UserID', 'Name', 'Checkin', 'Lat', 'Lon', 'Dist', 'Checkout']);
    if (name === SHEET_NAME_REMARKS) sh.appendRow(['Name', 'Time', 'Remark']);
    if (name === SHEET_NAME_USERS) sh.appendRow(['UserID', 'Name', 'Role']);
    if (name === SHEET_NAME_LOCATION) sh.appendRow(['Time', 'AdminID', 'AdminName', 'Lat', 'Lon']);
  }
  return sh;
}

function getUserInfo(sheet, userId) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++)
    if (String(data[i][0]) === String(userId))
      return { id: data[i][0], name: data[i][1], isAdmin: (data[i][2] || '').toLowerCase() === 'admin' };
  return null;
}

function checkIfAdmin(userId) {
  // Update this list as needed
  return ['6010138579'].includes(String(userId));
}

function addHoursToTime(time, hours) {
  const [H, M] = time.split(':').map(Number);
  const result = new Date(0, 0, 0, H, M + (parseInt(hours) * 60));
  return `${String(result.getHours()).padStart(2, '0')}:${String(result.getMinutes()).padStart(2, '0')}`;
}

function subtractHoursFromTime(time, hours) {
  const [H, M] = time.split(':').map(Number);
  const result = new Date(0, 0, 0, H, M - (parseInt(hours) * 60));
  return `${String(result.getHours()).padStart(2, '0')}:${String(result.getMinutes()).padStart(2, '0')}`;
}

function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000, toR = x => x * Math.PI / 180;
  const dLat = toR(lat2 - lat1), dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function requestLocation(chatId) {
  const payload = {
    chat_id: chatId,
    text: "📍 Gửi vị trí:",
    reply_markup: {
      keyboard: [[{ text: "Gửi vị trí", request_location: true }]],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  };
  UrlFetchApp.fetch(`https://hung.testhungw.workers.dev/bot${TOKEN}/sendMessage`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  });
}

function sendMessage(chatId, text) {
  UrlFetchApp.fetch(`https://hung.testhungw.workers.dev/bot${TOKEN}/sendMessage`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  });
}

function setupSheets() {
  getOrCreateSheet(SHEET_NAME_USERS);
  getOrCreateSheet(SHEET_NAME_SCHEDULE);
  getOrCreateSheet(SHEET_NAME_ATTENDANCE);
  getOrCreateSheet(SHEET_NAME_REMARKS);
  getOrCreateSheet(SHEET_NAME_LOCATION); // Tạo sheet lưu lịch sử vị trí nếu chưa có
}
