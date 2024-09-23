const MAX_ROWS = 20
const SHEET_ID = ''
const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet()

function doPost(e) {
	const data = JSON.parse(e.postData.contents)
	const saveData = data.saveData
	const cookieCount = data.cookieCount
	const unixTime = data.unixTime

	sheet.appendRow([saveData, cookieCount, unixTime])

	if (MAX_ROWS < sheet.getLastRow()) {
		sheet.deleteRow(1)
	}

	const responseData = JSON.stringify({
		saveData,
		cookieCount,
		unixTime
	})

	return ContentService
		.createTextOutput(responseData)
		.setMimeType(ContentService.MimeType.JSON)
}

function doGet() {
	const range = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn())
	const data = range.getValues()
	const responseData = data.map(i => {
		return {
			saveData: i[0],
			cookieCount: i[1],
			unixTime: i[2]
		}
	})

	return ContentService
		.createTextOutput(JSON.stringify(responseData))
		.setMimeType(ContentService.MimeType.JSON)
}
