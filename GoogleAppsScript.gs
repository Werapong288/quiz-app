function doGet() {
  return ContentService
    .createTextOutput('Quiz App Web App is running.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const payload = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName('Responses');

    if (!sheet) {
      sheet = spreadsheet.insertSheet('Responses');
    }

    const headers = [
      'ชื่อ-นามสกุล',
      'คะแนน',
      'จำนวนข้อ',
      'ร้อยละ',
      'ตอบถูก',
      'ตอบผิด',
      'ยังไม่ได้ตอบ',
      'วันที่และเวลา'
    ];

    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    const headerRow = headerRange.getValues()[0];
    const hasExpectedHeader = headerRow.length === headers.length &&
      headerRow.every((value, index) => value === headers[index]);

    if (!hasExpectedHeader) {
      if (sheet.getLastRow() === 0) {
        headerRange.setValues([headers]);
      } else {
        sheet.insertRowBefore(1);
        headerRange.setValues([headers]);
      }
    }

    const thaiFormatter = new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const submittedAt = payload.submittedAt
      ? thaiFormatter.format(new Date(payload.submittedAt))
      : thaiFormatter.format(new Date());

    sheet.appendRow([
      payload.name || '',
      payload.score || 0,
      payload.total || 0,
      payload.percentage || 0,
      payload.correctCount || 0,
      payload.incorrectCount || 0,
      payload.unansweredCount || 0,
      submittedAt
    ]);

    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}