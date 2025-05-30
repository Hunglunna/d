// Version 1.1.1 - Được phát triển vào ngày 30/05/2025. 
var TOKEN = "8186873023:AAG5reANeWePskwUBRx6W-Yk8rqv4H1oI88";
var SHEET_ID = "188d1O8r5nc3hzXADyvBNz_fLFfr6hUt626F2IlhMRrk";
var SHEET_NAME = "Lương";
function setupSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet(); 

  // Định dạng tiêu đề
  var headers = [["User ID", "📅 Ngày", "# Giờ làm", "💰 Lương (VND)"]];
  sheet.getRange("A1:D1").setValues(headers);
  
  // Căn giữa tiêu đề và in đậm
  sheet.getRange("A1:D1").setHorizontalAlignment("center").setFontWeight("bold");
  
  // Màu nền tiêu đề
  sheet.getRange("A1:C1").setBackground("#000000").setFontColor("#FFFFFF"); // Đen chữ trắng
  sheet.getRange("D1").setBackground("#00FF00").setFontColor("#000000"); // Xanh lá chữ đen

  // Định dạng cột "Ngày" thành kiểu ngày
  sheet.getRange("B2:B").setNumberFormat("dd/MM/yyyy");

  // Định dạng cột "Lương (VND)"
  sheet.getRange("D2:D").setNumberFormat("#,##0.000 đ"); 
}
function setTelegramWebhook() {
  var url = "https://ancient-salad-f2b2.testhungw.workers.dev/bot8186873023:AAG5reANeWePskwUBRx6W-Yk8rqv4H1oI88/setWebhook";
  var payload = {
    "url": "https://script.google.com/macros/s/AKfycbzpksvOUsmnv3fC2J1kkcep7_trcVA_K3Qf5iUJ2MSqEye8SewctqHTwwCVHp_y240j/exec"
  };
  
  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload)
  };
  
  var response = UrlFetchApp.fetch(url, options);
  Logger.log(response.getContentText());
}
function t3() {
  ScriptApp.newTrigger("t1")
    .timeBased()
    .atHour(16) 
    .everyDays(1)
    .create();
  ScriptApp.newTrigger("t2")
    .timeBased()
    .onMonthDay(1)
    .atHour(6) 
    .create();
}
function t1() { 
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var now = new Date();
  var hour = now.getHours();
  var today = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd");
  var notifiedUsers = [];

  if (hour < 16) return; // Chỉ chạy từ 16h trở đi

  var userIds = new Set(data.slice(1).map(row => row[0]));

  userIds.forEach(userId => {
    var hasEntry = data.some(row => row[0] == userId && Utilities.formatDate(new Date(row[1]), Session.getScriptTimeZone(), "yyyy-MM-dd") === today);
    
    if (!hasEntry) {
      sendMessage(userId, "⚠ Vui lòng nhập giờ làm hôm nay!");
      notifiedUsers.push(userId);
    }
  });

  if (notifiedUsers.length > 0) {
    Logger.log("Đã gửi nhắc nhở cho: " + notifiedUsers.join(", "));
    deleteExistingTriggers();
    ScriptApp.newTrigger("t1")
      .timeBased()
      .after(60000) // 1 phút
      .create();
  } else {
    Logger.log("Tất cả user đã nhập giờ làm hôm nay.");
    deleteExistingTriggers(); // Xóa trigger nếu đã có đủ dữ liệu
    ScriptApp.newTrigger("t1")
    .timeBased()
    .atHour(16) 
    .everyDays(1)
    .create();
  }
}

function deleteExistingTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === "t1") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}
function t2() {
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getRange("A2:A" + sheet.getLastRow()).getValues().flat(); // Lấy danh sách chatId từ cột A

  const uniqueUserIds = [...new Set(data.filter(id => typeof id === "number"))]; // Lọc trùng

  if (uniqueUserIds.length === 0) {
    Logger.log("Không có User ID hợp lệ.");
    return;
  }

  const today = new Date();
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  uniqueUserIds.forEach(chatId => {
    var monthlyHours = 0, monthlySalary = 0;
    var sheetData = sheet.getDataRange().getValues();

    for (var i = 1; i < sheetData.length; i++) {
      if (sheetData[i][0] == chatId) {
        var entryDate = new Date(sheetData[i][1]);
        var hours = sheetData[i][2];
        var salary = sheetData[i][3];

        if (entryDate >= lastMonthStart && entryDate <= lastMonthEnd) {
          monthlyHours += hours;
          monthlySalary += salary;
        }
      }
    }

    const message = `📊 Báo cáo tháng trước:\n🕒 Tổng giờ làm: ${monthlyHours} giờ\n💰 Tổng lương: ${monthlySalary.toLocaleString()} VND`;
    const url = `https://ancient-salad-f2b2.testhungw.workers.dev/bot${TOKEN}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(message)}`;

    try {
      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      const result = JSON.parse(response.getContentText());
      if (!result.ok) {
        Logger.log(`Lỗi với chatId ${chatId}: ${result.description}`);
      }
    } catch (error) {
      Logger.log(`Lỗi khi gửi tin nhắn: ${error.message}`);
    }
  });
}
function checkSalaryTarget(chatId, userId) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var now = new Date();
  var tz = Session.getScriptTimeZone();

  var thisMonth = Utilities.formatDate(now, tz, "MM");
  var thisYear = Utilities.formatDate(now, tz, "yyyy");

  var totalHours = 0;
  var totalSalary = 0;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(userId)) {
      var entryDate = new Date(data[i][1]);
      var month = Utilities.formatDate(entryDate, tz, "MM");
      var year = Utilities.formatDate(entryDate, tz, "yyyy");
      if (month === thisMonth && year === thisYear) {
        totalHours += Number(data[i][2]);
        totalSalary += Number(data[i][3]);
      }
    }
  }

  var message = "";
  if (totalHours >= 300 || totalSalary >= 4800000) {
    message =
      `🎉 Chúc mừng bạn đã đạt chỉ tiêu tháng!\n` +
      `🕒 Tổng giờ: ${totalHours}\n` +
      `💰 Tổng lương: ${totalSalary.toLocaleString()} VND\n` +
      `Hãy tiếp tục phát huy nhé! 🚀`;
  } else {
    message =
      `💡 Bạn chưa đạt chỉ tiêu tháng (300 giờ hoặc 4,800,000 VND).\n` +
      `🕒 Giờ hiện tại: ${totalHours}/300\n` +
      `💰 Lương hiện tại: ${totalSalary.toLocaleString()}/4,800,000 VND\n` +
      `Cố gắng hơn ở những ngày tiếp theo nhé! 💪`;
  }
  sendMessage(chatId, message);
}
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var message = data.message;
  var chatId = message.chat.id;
  var text = message.text;
  var userId = message.from.id; // Lấy User ID của người gửi

  if (text.startsWith("/start")) {
    setupSheet();
    sendMessage(chatId, "📌 *Lệnh Menu:*\n\n" +
      "🔹 `/start` – Bắt đầu\n" +
      "🔹 `/luong <số giờ>` – Thêm giờ làm\n" +
      "🔹 `/tl` – Tổng lương từ khi dùng bot\n" +
      "🔹 `/homqua` – Lương hôm qua\n" +
      "🔹 `/reset` – Đặt lại dữ liệu\n" +
      "🔹 `/thongke` – Thống kê trong tháng\n" +
      "🔹 `/edit <ngày>(DD,DD/MM,DD/MM/YYYY) <số giờ>` – Chỉnh sửa giờ\n" +
      "🔹 `/xoa <ngày>(DD,DD/MM,DD/MM/YYYY)` – Xóa giờ\n" +
      "🔹 `/export` – Xuất CSV\n" +
      "🔹 `/odx` – Bị phạt (-100k, -6.25 giờ)\n" +
      "🔹 `/tru <số tiền>` – Trừ lương\n"+
      "🔹 `/off` – Nghĩ\n" +
      "🔹 `/bieudo` – Xuất ảnh biểu đồ các tháng\n" +
      "🔹 `/bieudoht` – Xuất ảnh biểu đồ hiện tại\n" +
      "🔹 `/kpi` – chỉ tiêu hàng tháng"
    );
  } else if (text.startsWith("/luong ")) {
    var hours = parseFloat(text.split(" ")[1]);
    if (!isNaN(hours)) {
      recordHours(chatId, userId, hours);
    } else {
      sendMessage(chatId, "⚠ Vui lòng nhập số giờ hợp lệ!");
    }
  } else if (text.startsWith("/edit ")) {
    var parts = text.split(" ");
    var date = parts[1];
    var hours = parseFloat(parts[2]);
    if (!isNaN(hours)) {
      editHours(chatId, userId, date, hours);
    } else {
      sendMessage(chatId, "⚠ Vui lòng nhập đúng định dạng: /edit dd <số giờ>");
    }
  } else if (text.startsWith("/xoa ")) {
    var date = text.split(" ")[1];
    deleteEntry(chatId, userId, date);
  } else if (text == "/tl") {
    getTotalSalary(chatId, userId);
  } else if (text == "/homqua") {
    getYesterdaySalary(chatId, userId);
  } else if (text == "/reset") {
    sendMessage(chatId, "❗ Bạn có chắc chắn muốn xóa dữ liệu? Nhập `/confirm_reset` để xác nhận.");
  } else if (text == "/confirm_reset") {
    if (clearUserData(userId)) {
      sendMessage(chatId, "✅ Dữ liệu của bạn đã được reset!");
    } else {
      sendMessage(chatId, "⚠ Không tìm thấy dữ liệu để xóa.");
    }
  } else if (text == "/thongke") {
    getStatistics(chatId, userId);
  } else if (text == "/export") {
    exportDataToCSV(chatId, userId);
  } else if (text == "/odx") {
    recordHours(chatId, userId, -6.25, -100000);
    sendMessage(chatId, "⚠ Bạn đã bị phạt -100,000 VND (-6.25 giờ).");
  } else if (text.startsWith("/tru ")) {
    var amount = parseFloat(text.split(" ")[1]) * 1000; // Tự động nhân 1000
    if (!isNaN(amount)) {
      var deductedHours = amount / 16000;
      recordHours(chatId, userId, -deductedHours, -amount);
      sendMessage(chatId, `⚠ Đã trừ ${amount.toLocaleString()} VND (-${deductedHours.toFixed(2)} giờ).`);
    } else {
      sendMessage(chatId, "⚠ Vui lòng nhập số tiền hợp lệ!");
    }
  } else if (text == "/off") {
    recordHours(chatId, userId, 0);
  } else if (text === "/file") {
    sendFileToTelegram(chatId);
  } else if (text === "/cre") {
    sendFileToTelegramcre(chatId);
  } 
  // Lệnh mới: xuất ảnh biểu đồ gửi lên Telegram
  else if (text === "/bieudoht") {
    bieudoht(chatId, userId);
  }else if (text === "/bieudo") {
    bieudo(chatId, userId);
  }else if (text === "/kpi") {
    checkSalaryTarget(chatId, userId);
  }
}
function bieudo(chatId, userId) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();

  var tz = Session.getScriptTimeZone();
  var now = new Date();
  var currentMonth = Number(Utilities.formatDate(now, tz, "MM"));
  var currentYear = Number(Utilities.formatDate(now, tz, "yyyy"));

  // Gom lương theo từng tháng
  var salaryByMonth = {}; // key: MM/YYYY, value: tổng lương

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) == String(userId)) {
      var date = new Date(data[i][1]);
      var month = Utilities.formatDate(date, tz, "MM");
      var year = Utilities.formatDate(date, tz, "yyyy");
      var key = month + "/" + year;

      // Chỉ tính tháng <= tháng hiện tại cùng năm, hoặc năm nhỏ hơn
      if ((Number(year) < currentYear) || (Number(year) === currentYear && Number(month) <= currentMonth)) {
        var salaryRaw = String(data[i][3]).replaceAll("₫", "").replaceAll(" ", "").replaceAll(",", "");
        var salary = Number(salaryRaw.replace(/[^\d\.-]/g, ""));
        if (isNaN(salary)) salary = 0;
        salaryByMonth[key] = (salaryByMonth[key] || 0) + salary;
      }
    }
  }

  // Sắp xếp các tháng tăng dần
  var keys = Object.keys(salaryByMonth);
  keys.sort(function(a, b) {
    // Định dạng a/b: MM/YYYY
    var [ma, ya] = a.split("/").map(Number);
    var [mb, yb] = b.split("/").map(Number);
    if (ya !== yb) return ya - yb;
    return ma - mb;
  });

  if (keys.length === 0) {
    sendMessage(chatId, "⚠ Không có dữ liệu để tạo biểu đồ tổng lương các tháng.");
    return;
  }

  // Tạo dữ liệu cho biểu đồ
  var chartData = [["Tháng", "Tổng lương"]];
  for (var i = 0; i < keys.length; i++) {
    chartData.push([keys[i], salaryByMonth[keys[i]]]);
  }

  // Tiêu đề biểu đồ
  var lastMonthLabel = keys[keys.length - 1];
  var title = "Tổng lương các tháng (tới tháng " + lastMonthLabel + ")";
  var caption = "📊 Biểu đồ tổng lương các tháng (tháng hiện tại tính đến hôm nay)";

  // Vẽ biểu đồ cột
  var dataTable = Charts.newDataTable()
    .addColumn(Charts.ColumnType.STRING, "Tháng")
    .addColumn(Charts.ColumnType.NUMBER, "Tổng lương");
  for (var k = 1; k < chartData.length; k++) {
    dataTable.addRow(chartData[k]);
  }

  var chart = Charts.newColumnChart()
    .setTitle(title)
    .setXAxisTitle("Tháng")
    .setYAxisTitle("VND")
    .setDimensions(900, 500)
    .setDataTable(dataTable)
    .build();

  var blob = chart.getAs("image/png").setName("bieudo_thang.png");
  var imgFile = DriveApp.createFile(blob);
  imgFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var fileId = imgFile.getId();
  var publicPhotoUrl = "https://drive.google.com/uc?export=download&id=" + fileId;

  // Gửi qua Telegram sendPhoto (nếu không được thì gửi link)
  var telegramUrl = "https://ancient-salad-f2b2.testhungw.workers.dev/bot" + TOKEN + "/sendPhoto";
  var payload = {
    "chat_id": chatId,
    "photo": publicPhotoUrl,
    "caption": caption
  };
  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  var response = UrlFetchApp.fetch(telegramUrl, options);

  try {
    var result = JSON.parse(response.getContentText());
    if (!result.ok) {
      sendMessage(chatId, "Không gửi được ảnh trực tiếp. Xem ảnh biểu đồ tại đây: " + publicPhotoUrl);
    }
  } catch (e) {
    sendMessage(chatId, "Không gửi được ảnh trực tiếp. Xem ảnh biểu đồ tại đây: " + publicPhotoUrl);
  }
}
function bieudoht(chatId, userId) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();

  // Xác định tháng/năm và ngày hiện tại
  var now = new Date();
  var tz = Session.getScriptTimeZone();
  var monthNow = Number(Utilities.formatDate(now, tz, "MM"));
  var yearNow = Number(Utilities.formatDate(now, tz, "yyyy"));
  var dayNow = Number(Utilities.formatDate(now, tz, "dd"));

  // Tạo map lương theo từng ngày
  var salaryByDay = {};

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) == String(userId)) {
      var rawDate = new Date(data[i][1]);
      var month = Number(Utilities.formatDate(rawDate, tz, "MM"));
      var year = Number(Utilities.formatDate(rawDate, tz, "yyyy"));
      if (month !== monthNow || year !== yearNow) continue;

      var day = Utilities.formatDate(rawDate, tz, "dd");
      var salaryRaw = String(data[i][3]).replaceAll("₫", "").replaceAll(" ", "").replaceAll(",", "");
      var salary = Number(salaryRaw.replace(/[^\d\.-]/g, ""));
      if (isNaN(salary)) salary = 0;

      salaryByDay[day] = (salaryByDay[day] || 0) + salary;
    }
  }

  // Chỉ vẽ đến ngày hiện tại
  var chartData = [['Ngày', 'Tổng lương lũy kế']];
  var luyKe = 0;

  for (var d = 1; d <= dayNow; d++) {
    var dayStr = d.toString().padStart(2, '0');
    luyKe += salaryByDay[dayStr] || 0;
    chartData.push([dayStr, luyKe]);
  }

  // Kiểm tra nếu không có dữ liệu
  if (chartData.length === 1 || luyKe === 0) {
    sendMessage(chatId, "⚠ Không có dữ liệu nào trong tháng này để tạo biểu đồ.");
    return;
  }

  // Vẽ biểu đồ
  var dataTable = Charts.newDataTable()
    .addColumn(Charts.ColumnType.STRING, "Ngày")
    .addColumn(Charts.ColumnType.NUMBER, "Tổng lương lũy kế");
  for (var k = 1; k < chartData.length; k++) {
    dataTable.addRow(chartData[k]);
  }

  var chart = Charts.newLineChart()
    .setTitle("Tổng lương lũy kế tháng " + monthNow + "/" + yearNow)
    .setXAxisTitle("Ngày")
    .setYAxisTitle("VND")
    .setDimensions(900, 500)
    .setCurveStyle(Charts.CurveStyle.SMOOTH)
    .setDataTable(dataTable)
    .build();

  var blob = chart.getAs("image/png").setName("bieudo.png");
  var imgFile = DriveApp.createFile(blob);
  imgFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var fileId = imgFile.getId();
  var publicPhotoUrl = "https://drive.google.com/uc?export=download&id=" + fileId;

  // Gửi qua Telegram sendPhoto (nếu không được thì gửi link)
  var telegramUrl = "https://ancient-salad-f2b2.testhungw.workers.dev/bot" + TOKEN + "/sendPhoto";
  var payload = {
    "chat_id": chatId,
    "photo": publicPhotoUrl,
    "caption": "📊 Biểu đồ tổng lương lũy kế tháng " + monthNow + "/" + yearNow + " (tới ngày " + dayNow + ")"
  };
  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  var response = UrlFetchApp.fetch(telegramUrl, options);

  // Nếu gửi ảnh lỗi, gửi link
  try {
    var result = JSON.parse(response.getContentText());
    if (!result.ok) {
      sendMessage(chatId, "Không gửi được ảnh trực tiếp. Xem ảnh biểu đồ tại đây: " + publicPhotoUrl);
    }
  } catch (e) {
    sendMessage(chatId, "Không gửi được ảnh trực tiếp. Xem ảnh biểu đồ tại đây: " + publicPhotoUrl);
  }
}
// Hàm để tránh lỗi do thiếu doGet
function doGet(e) {
  return ContentService.createTextOutput("Bot đang hoạt động!");
}


function editHours(chatId, userId, inputDate, newHours) {
  if (!inputDate || !newHours) {
    sendMessage(chatId, "ℹ️ Cách dùng: /edit DD HH hoặc /edit DD/MM HH hoặc /edit DD/MM/YYYY HH");
    return;
  }
  
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var found = false;

  var today = new Date();
  var currentYear = today.getFullYear();
  var currentMonth = (today.getMonth() + 1).toString().padStart(2, '0');
  
  var parts = inputDate.split('/');
  var day, month, year;
  
  if (parts.length === 1) {
    day = parts[0].padStart(2, '0');
    month = currentMonth;
    year = currentYear;
  } else if (parts.length === 2) {
    day = parts[0].padStart(2, '0');
    month = parts[1].padStart(2, '0');
    year = currentYear;
  } else if (parts.length === 3) {
    day = parts[0].padStart(2, '0');
    month = parts[1].padStart(2, '0');
    year = parts[2];
  } else {
    sendMessage(chatId, "❌ Định dạng ngày không hợp lệ!");
    return;
  }

  var date = `${year}-${month}-${day}`;
  var date1 = `${day}/${month}/${year}`;
  for (var i = 1; i < data.length; i++) {
    var storedUserId = String(data[i][0]);
    var storedDate = Utilities.formatDate(new Date(data[i][1]), Session.getScriptTimeZone(), "yyyy-MM-dd");

    if (storedUserId === String(userId) && storedDate === date) {
      var newSalary = newHours * 16000;
      sheet.getRange(i + 1, 3).setValue(newHours);
      sheet.getRange(i + 1, 4).setValue(newSalary);
      sendMessage(chatId, `✅ Đã chỉnh sửa ngày ${date1}: ${newHours} giờ, lương: ${newSalary.toLocaleString("vi-VN")} VND`);
      found = true;
      break;
    }
  }

  if (!found) sendMessage(chatId, "⚠ Không tìm thấy dữ liệu để chỉnh sửa!");
}


function exportDataToCSV(chatId, userId) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();

  // Lọc dữ liệu chỉ cho userId hiện tại
  var userData = data.filter(row => row[0] == userId);

  // Nếu không có dữ liệu cho userId, gửi thông báo
  if (userData.length === 0) {
    sendMessage(chatId, "⚠ Không có dữ liệu để xuất cho bạn.");
    return;
  }

  var csvContent = userData.map(row => row.join(",")).join("\n");
  var file = DriveApp.createFile("timesheet_" + userId + ".csv", csvContent, MimeType.PLAIN_TEXT);
  var fileId = file.getId();
  var downloadUrl = "https://drive.google.com/uc?export=download&id=" + fileId;

  var message = "📎 Tải file CSV [tại đây](" + downloadUrl + ")"; // Markdown link

  var url = `https://ancient-salad-f2b2.testhungw.workers.dev/bot${TOKEN}/sendMessage`;
  var payload = {
    "chat_id": chatId,
    "text": message,
    "parse_mode": "Markdown" // Hoặc thay bằng "HTML" nếu muốn dùng thẻ <a>
  };

  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload)
  };

  UrlFetchApp.fetch(url, options);
}


function deleteEntry(chatId, userId, inputDate) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var today = new Date();
  var currentMonth = Utilities.formatDate(today, Session.getScriptTimeZone(), "MM");
  var currentYear = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy");

  var parts = inputDate.split("/").map(p => p.trim());
  var day, month, year;

  if (parts.length === 1) {
    // Nếu chỉ nhập ngày
    day = parts[0].padStart(2, '0');
    month = currentMonth;
    year = currentYear;
  } else if (parts.length === 2) {
    // Nếu nhập ngày/tháng
    day = parts[0].padStart(2, '0');
    month = parts[1].padStart(2, '0');
    year = currentYear;
  } else if (parts.length === 3) {
    // Nếu nhập đầy đủ ngày/tháng/năm
    day = parts[0].padStart(2, '0');
    month = parts[1].padStart(2, '0');
    year = parts[2];
  } else {
    sendMessage(chatId, "⚠ Định dạng ngày không hợp lệ! Nhập theo DD, DD/MM hoặc DD/MM/YYYY.");
    return;
  }

  var dateStr = `${day}/${month}/${year}`;
  var date = new Date(`${year}-${month}-${day}`); // Chuyển thành YYYY-MM-DD để tạo Date object

  if (isNaN(date.getTime())) {
    sendMessage(chatId, "⚠ Ngày không hợp lệ!");
    return;
  }

  var deletedRecords = [];

  var indices = data.map((row, i) => {
    var sheetDate = Utilities.formatDate(new Date(row[1]), Session.getScriptTimeZone(), "dd/MM/yyyy");
    if (row[0].toString().trim() === userId.toString().trim() && sheetDate === dateStr) {
      var hours = row[2] + " giờ";  
      var salary = row[3].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " VNĐ"; 
      deletedRecords.push(`🗑 ${hours}, lương: ${salary}`);
      return i + 1;
    }
    return null;
  }).filter(Boolean);

  indices.reverse().forEach(i => sheet.deleteRow(i));

  if (indices.length) {
    sendMessage(chatId, `✅ Đã xóa ${indices.length} bản ghi:\n${deletedRecords.join("\n")}`);
  } else {
    sendMessage(chatId, "⚠ Không tìm thấy dữ liệu!");
  }
}



function sendDailyReport() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var today = new Date().toISOString().split("T")[0];
  var userReports = {};
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] == today) {
      var userId = data[i][0];
      var hours = data[i][2];
      var salary = data[i][3];
      if (!userReports[userId]) userReports[userId] = { hours: 0, salary: 0 };
      userReports[userId].hours += hours;
      userReports[userId].salary += salary;
    }
  }
  for (var userId in userReports) {
    sendMessage(userId, `📅 Báo cáo hôm nay:
🕒 Tổng giờ làm: ${userReports[userId].hours}
💰 Tổng lương: ${userReports[userId].salary.toLocaleString()} VND`);
  }
}

function scheduleDailyReport() {
  ScriptApp.newTrigger("sendDailyReport").timeBased().atHour(23).nearMinute(59).everyDays(1).create();
}


function getYesterdaySalary(chatId, userId) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  
  var timeZone = Session.getScriptTimeZone(); // Lấy múi giờ đúng của Google Apps Script
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  var yesterdayStr = Utilities.formatDate(yesterday, timeZone, "yyyy-MM-dd"); // Format ngày chính xác

  var totalHours = 0, totalSalary = 0;

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == userId) {
      var entryDateStr = data[i][1]; // Ngày từ Google Sheets
      var entryDate = new Date(entryDateStr);
      
      if (isNaN(entryDate.getTime())) {
        entryDate = new Date(entryDateStr.replace(/-/g, "/"));
      }

      var entryDateFormatted = Utilities.formatDate(entryDate, timeZone, "yyyy-MM-dd"); // Định dạng lại

      if (entryDateFormatted === yesterdayStr) { // So sánh chính xác
        totalHours += data[i][2];
        totalSalary += data[i][3];
      }
    }
  }

  if (totalHours > 0) {
    sendMessage(chatId, `📅 Ngày hôm qua (${yesterdayStr}):\n🕒 Giờ làm: ${totalHours}\n💰 Lương: ${totalSalary.toLocaleString()} VND`);
  } else {
    sendMessage(chatId, "📅 Hôm qua bạn không làm việc!");
  }
}
function getSalaryRate() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Config");
  return sheet.getRange("B1").getValue(); // Ô B1 chứa tỷ giá
}








function getStatistics(chatId, userId) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var today = new Date();
  var weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
  var monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  var dailyHours = 0, dailySalary = 0;
  var weeklyHours = 0, weeklySalary = 0;
  var monthlyHours = 0, monthlySalary = 0;

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == userId) {
      var entryDate = new Date(data[i][1]);
      var hours = data[i][2];
      var salary = data[i][3];
      
      if (entryDate.toDateString() === new Date().toDateString()) {
        dailyHours += hours;
        dailySalary += salary;
      }
      if (entryDate >= weekStart) {
        weeklyHours += hours;
        weeklySalary += salary;
      }
      if (entryDate >= monthStart) {
        monthlyHours += hours;
        monthlySalary += salary;
      }
    }
  }

  sendMessage(chatId, `📊 Thống kê thu nhập:
🔹 Hôm nay: ${dailyHours} giờ, ${dailySalary.toLocaleString()} VND
🔹 Tuần này: ${weeklyHours} giờ, ${weeklySalary.toLocaleString()} VND
🔹 Tháng này: ${monthlyHours} giờ, ${monthlySalary.toLocaleString()} VND`);
}



function recordHours(chatId, userId, hours, salary = null) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  var date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  // Hỗ trợ định dạng thập phân bằng dấu phẩy
  hours = parseFloat(hours.toString().replace(",", "."));

  // Kiểm tra hợp lệ
  if (isNaN(hours)) {
    sendMessage(chatId, "❌ Số giờ không hợp lệ.");
    return;
  }

  // Tính lương mặc định nếu không truyền vào
  salary = salary !== null ? parseFloat(salary) : hours * 16000;

  // Ghi dữ liệu vào Google Sheet
  sheet.appendRow([userId, date, hours, salary]);

  sendMessage(chatId, `✅ Đã cập nhật: ${hours.toLocaleString("vi-VN")} giờ, lương: ${salary.toLocaleString("vi-VN")} VND`);
}





function getTotalSalary(chatId, userId) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var totalHours = 0, totalSalary = 0;

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == userId) {
      totalHours += data[i][2];
      totalSalary += data[i][3];
    }
  }
  sendMessage(chatId, `📊 Tổng giờ làm: ${totalHours}\n💰 Tổng lương: ${totalSalary.toLocaleString()} VND`);
}

function clearUserData(userId) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var rowsToDelete = [];

  for (var i = data.length - 1; i >= 0; i--) {
    if (data[i][0] == userId) {
      rowsToDelete.push(i + 1);
    }
  }

  if (rowsToDelete.length === 0) {
    return false; // Không có dữ liệu để xóa
  }

  rowsToDelete.forEach(row => sheet.deleteRow(row));
  return true; // Đã xóa thành công
}

function sendFileToTelegram(chatId) {
  
  var fileUrl = "https://raw.githubusercontent.com/Hunglunna/hung/refs/heads/master/bot.js"; 
  var message = "📎 Tải xuống tệp tin [tại đây](" + fileUrl + ")"; // Markdown link

  var url = `https://ancient-salad-f2b2.testhungw.workers.dev/bot${TOKEN}/sendMessage`;
  var payload = {
    "chat_id": chatId,
    "text": message,
    "parse_mode": "Markdown" // Đảm bảo Telegram hiển thị link đúng cách
  };

  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload)
  };

  UrlFetchApp.fetch(url, options);
}

function sendFileToTelegramcre(chatId) {
  
  var imageUrl = "https://scontent.fdad3-3.fna.fbcdn.net/v/t39.30808-6/494204052_624596410581026_6226721129955872958_n.jpg?_nc_cat=101&ccb=1-7&_nc_sid=6ee11a&_nc_eui2=AeGzO1dYg3s0edSa0ltE2GmTg58Y-FHles2Dnxj4UeV6zYHEFxZIU-CNDsdKmJe0yDchZ7sOcYqK4Fpga3YJmPLN&_nc_ohc=gXvRSnSvCggQ7kNvwFo4Vxw&_nc_oc=AdknfZ375KFtehESg50rN838RiNw4vy-crEHqnHMQJ_okGN7yZ7IDXfZjrAHpZ2bEP0ouH38qB2Ihb9nom88zS9Z&_nc_zt=23&_nc_ht=scontent.fdad3-3.fna&_nc_gid=lTPGkypHb5mBt6_3f02Rig&oh=00_AfJOEBNbFi2kwHZgd1Mz0slkBT0a3bB4BFLS-HBGy2GHvA&oe=682A7411"; // Đổi thành link ảnh thực tế
  var buttonUrl = "https://t.me/sfdfsdsbot/hunglunna"; // Nút bấm đến link này

  var payload = {
    chat_id: chatId,
    photo: imageUrl,
    caption: "",
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[
        {
          text: "LAUNCH",
          url: buttonUrl
        }
      ]]
    }
  };

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload)
  };

  var url = `https://ancient-salad-f2b2.testhungw.workers.dev/bot${TOKEN}/sendPhoto`;
  UrlFetchApp.fetch(url, options);
}



function sendMessage(chatId, text) {
  var url = `https://ancient-salad-f2b2.testhungw.workers.dev/bot${TOKEN}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(text)}`;
  UrlFetchApp.fetch(url);
}
