function getMonday(d) {
	d = new Date(d);
	var day = d.getDay(),
			diff = d.getDate() - day + (day == 0 ? -6:1); 
	return new Date(d.setDate(diff));
}
function addDays(date, days) {
	var result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}
function addZeroToMonth(month) {
	if (month < 10)
		return "0" + month.toString();
	else
		return month;
}
function getWeekDetails(startDate) {
	if  (!startDate)
		startDate = getMonday(new Date());
	endDate = addDays(startDate, 6)
	weekDetails = {
		startYear: startDate.getFullYear(),
		startMonth: addZeroToMonth(startDate.getMonth()+1),
		startDay: addZeroToMonth(startDate.getDate()),
		endYear: endDate.getFullYear(),
		endMonth: addZeroToMonth(endDate.getMonth()+1),
		endDay: addZeroToMonth(endDate.getDate())
	}
	return weekDetails;
}
module.exports = {
	getWeekDetails: (startDate) => {
		return getWeekDetails(startDate);
	},
	addZeroToMonth: (month) => {
		return addZeroToMonth(month);
	},
	addDays: (date, days) => {
		return addDays(date, days);
	},
	getMonday: (d) => {
		return getMonday(d);
	}
};