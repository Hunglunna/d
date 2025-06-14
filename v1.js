// === CẤU HÌNH ===
const TOKEN = '8017791851:AAEBpRUQwoY4-FHHJRM-f7baYgdo6hpDwaw';
const SHEET_ID = '1YER6PexGeD-2NlTS0JyHj-9yiukDdEqQC-WVcZ8-kh8';
const SHEET_NAME_USERS = 'users';
const SHEET_NAME_ATTENDANCE = 'attendance';

// === HÀM CHÍNH ===
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  if (!data.message) return;

  const chatId = data.message.chat.id;
  const userId = data.message.from.id.toString();
  const firstName = data.message.from.first_name || '';
  const text = data.message.text || '';
  const location = data.message.location;

  const sheetUsers = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME_USERS);
  const userInfo = getUserInfo(sheetUsers, userId);

  // === GỬI ĐỊNH VỊ ===
  if (location) {
    const lat = parseFloat(location.latitude);
    const lon = parseFloat(location.longitude);

    if (checkIfAdmin(userId)) {
      PropertiesService.getScriptProperties().setProperty('CHECKIN_LAT', lat.toString());
      PropertiesService.getScriptProperties().setProperty('CHECKIN_LON', lon.toString());
      sendMessage(chatId, `✅ Đã lưu điểm chấm công tại vị trí bạn vừa gửi.`);
    } else {
      const waiting = PropertiesService.getScriptProperties().getProperty(`WAITING_USER_LOCATION_${userId}`);
      if (waiting !== 'true') {
        sendMessage(chatId, `⚠️ Vui lòng dùng lệnh /checkin để chấm công.`);
        return;
      }
      PropertiesService.getScriptProperties().deleteProperty(`WAITING_USER_LOCATION_${userId}`);

      const checkLat = parseFloat(PropertiesService.getScriptProperties().getProperty('CHECKIN_LAT') || '0');
      const checkLon = parseFloat(PropertiesService.getScriptProperties().getProperty('CHECKIN_LON') || '0');
      const distance = getDistanceInMeters(lat, lon, checkLat, checkLon);

      if (isLikelyFakeLocation(userId, lat, lon)) {
        sendMessage(chatId, `⚠️ Bạn đang gửi định vị giống hệt nhiều lần. Vui lòng kiểm tra lại.`);
        return;
      }

      if (distance <= 100) {
        const name = userInfo?.name || firstName;
        const time = new Date();
        const sheetAttendance = getOrCreateSheet(SHEET_NAME_ATTENDANCE);
        sheetAttendance.appendRow([userId, name, time, lat, lon, Math.round(distance), '']);
        sendMessage(chatId, `📍 Bạn đã chấm công thành công lúc ${time.toLocaleTimeString()} (${Math.round(distance)}m từ điểm chấm công).`);
      } else {
        sendMessage(chatId, `⚠️ Bạn đang ở cách điểm chấm công ${Math.round(distance)}m. Vui lòng đến gần hơn (dưới 100m).`);
      }
    }
    return;
  }

  // === LỆNH /start ===
  if (text === '/start') {
    if (userInfo) {
      const roleText = userInfo.isAdmin ? 'admin' : 'người dùng';
      sendMessage(chatId, `👋 Xin chào ${roleText} ${userInfo.name || firstName}!`);
    } else {
      const isAdmin = checkIfAdmin(userId);
      if (isAdmin) {
        sheetUsers.appendRow([userId, firstName, 'admin']);
        sendMessage(chatId, `👋 Xin chào admin ${firstName}!`);
      } else {
        PropertiesService.getScriptProperties().setProperty(`WAITING_NAME_${userId}`, 'true');
        sendMessage(chatId, `👤 Vui lòng nhập *họ và tên đầy đủ* của bạn để đăng ký:`);
      }
    }
    return;
  }

  // === LỆNH /checkin ===
  if (text === '/checkin') {
    PropertiesService.getScriptProperties().setProperty(`WAITING_USER_LOCATION_${userId}`, 'true');
    requestLocation(chatId);
    return;
  }

  // === LỆNH /checkout ===
  if (text === '/checkout') {
  const sheetAttendance = getOrCreateSheet(SHEET_NAME_ATTENDANCE);
  const data = sheetAttendance.getDataRange().getValues();
  const today = new Date().toDateString();
  let found = false;

  for (let i = data.length - 1; i >= 1; i--) {
    const rowUserId = data[i][0]?.toString();
    const checkinTime = data[i][2];

    if (rowUserId === userId && checkinTime && new Date(checkinTime).toDateString() === today) {
      const checkoutCol = 6; // Cột G (Thời gian ra)
      const checkoutTime = new Date();
      const formattedTime = Utilities.formatDate(checkoutTime, Session.getScriptTimeZone(), "HH:mm:ss");

      // ❗️ Chỉ lưu HH:mm:ss vào sheet
      sheetAttendance.getRange(i + 1, checkoutCol + 1).setValue(formattedTime);

      sendMessage(chatId, `✅ Đã ghi nhận thời gian ra lúc ${formattedTime}.`);
      found = true;
      break;
    }
  }

  if (!found) {
    sendMessage(chatId, `⚠️ Bạn chưa checkin hôm nay. Vui lòng dùng /checkin trước.`);
  }
  return;
}


  // === XỬ LÝ NHẬP TÊN ===
  const waiting = PropertiesService.getScriptProperties().getProperty(`WAITING_NAME_${userId}`);
  if (waiting === 'true') {
    const fullName = text.trim();
    if (!fullName || fullName.length < 3) {
      sendMessage(chatId, `⚠️ Vui lòng nhập đúng họ và tên (ít nhất 3 ký tự).`);
      return;
    }
    sheetUsers.appendRow([userId, fullName, 'user']);
    PropertiesService.getScriptProperties().deleteProperty(`WAITING_NAME_${userId}`);
    sendMessage(chatId, `✅ Đã lưu tên của bạn là "${fullName}".`);
  }
}

// === TIỆN ÍCH ===
function sendMessage(chat_id, text) {
  const url = `https://hung.testhungw.workers.dev/bot${TOKEN}/sendMessage`;
  const payload = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      chat_id: chat_id,
      text: text,
      parse_mode: 'Markdown'
    }),
  };
  UrlFetchApp.fetch(url, payload);
}

function requestLocation(chat_id) {
  const url = `https://hung.testhungw.workers.dev/bot${TOKEN}/sendMessage`;
  const payload = {
    chat_id,
    text: "📍 Nhấn nút bên dưới để gửi vị trí hiện tại của bạn:",
    reply_markup: JSON.stringify({
      keyboard: [[{ text: "📍 Gửi vị trí hiện tại", request_location: true }]],
      one_time_keyboard: true,
      resize_keyboard: true
    })
  };
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  });
}

function checkIfAdmin(userId) {
  const ADMIN_IDS = ['6010138579'];
  return ADMIN_IDS.includes(userId);
}

function getUserInfo(sheet, userId) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === userId) {
      const role = (data[i][2] || '').toString().toLowerCase();
      return {
        id: data[i][0],
        name: data[i][1],
        isAdmin: role === 'admin'
      };
    }
  }
  return null;
}

function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function setupSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheetUsers = ss.getSheetByName(SHEET_NAME_USERS);
  if (!sheetUsers) {
    sheetUsers = ss.insertSheet(SHEET_NAME_USERS);
    sheetUsers.appendRow(['Telegram ID', 'Tên', 'IsAdmin']);
  }
  let sheetAttendance = ss.getSheetByName(SHEET_NAME_ATTENDANCE);
  if (!sheetAttendance) {
    sheetAttendance = ss.insertSheet(SHEET_NAME_ATTENDANCE);
    sheetAttendance.appendRow(['Telegram ID', 'Tên', 'Lat', 'Lon', 'Khoảng cách (m)','Thời gian vào', 'Thời gian ra']);
  }
}

function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isLikelyFakeLocation(userId, lat, lon) {
  const lastLat = PropertiesService.getScriptProperties().getProperty(`LAST_LAT_${userId}`);
  const lastLon = PropertiesService.getScriptProperties().getProperty(`LAST_LON_${userId}`);
  const lastTime = PropertiesService.getScriptProperties().getProperty(`LAST_TIME_${userId}`);
  const now = new Date().getTime();

  if (lastLat && lastLon && lastTime) {
    const dist = getDistanceInMeters(parseFloat(lat), parseFloat(lon), parseFloat(lastLat), parseFloat(lastLon));
    const timeDiff = now - parseInt(lastTime); // milliseconds

    // Nếu vị trí giống và gửi lại trong vòng 60 giây → cảnh báo
    if (dist < 3 && timeDiff < 60 * 1000) return true;
  }

  // Lưu lại lần gửi này
  PropertiesService.getScriptProperties().setProperty(`LAST_LAT_${userId}`, lat.toString());
  PropertiesService.getScriptProperties().setProperty(`LAST_LON_${userId}`, lon.toString());
  PropertiesService.getScriptProperties().setProperty(`LAST_TIME_${userId}`, now.toString());

  return false;
}
