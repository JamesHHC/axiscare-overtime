process.title='AxisCare OT';

require('dotenv').config();
const express = require('express');
var opener = require("opener");
const app = express();

const VISIT_API = `https://${process.env.AXISCARE_ID}.axiscare.com/api/visits`;
const API_VERSION = '2023-10-01';
const PORT = process.env.PORT || 2121;
const THRESHOLD = process.env.THRESHOLD;
const REFRESH_MIN = process.env.REFRESH_MINUTES || 5;

let cachedOverHours = [];
let lastUpdated = null;
app.get('/api/overhours', (req, res) => {
	res.json({
		'info': cachedOverHours,
		'updated': lastUpdated,
	});
});

app.use(express.static('public'));

app.use((req, res, next) => {
	res.setHeader("Content-Security-Policy",
		"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;");
	next();
});

app.listen(PORT, () => {
	console.log('Dashboard available at', `http://localhost:${PORT}`);
	opener(`http://localhost:${PORT}`);
	main();
	setInterval(main, REFRESH_MIN * 60 * 1000);
});

function getCurrentWeekRange() {
	const today = new Date();
	const dayOfWeek = today.getDay();

	// Sunday this week
	const sunday = new Date(today);
	sunday.setDate(today.getDate() - dayOfWeek);

	// Saturday this week
	const saturday = new Date(today);
	saturday.setDate(today.getDate() + (6 - dayOfWeek));

	// Saturday next week
	const nextSaturday = new Date(today);
	nextSaturday.setDate(today.getDate() + (13 - dayOfWeek));

	const formatDate = (date) => `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
	return { start: formatDate(sunday), end: formatDate(nextSaturday), breakDate: saturday };
}

function isDateAfter(dateA, dateB) {
	const a = new Date(dateA.toDateString());
	const b = new Date(dateB.toDateString());

	// Not sensitive to time
	return a > b;
}

async function fetchVisits(startDate, endDate, url = VISIT_API) {
	try {
		const fullURL = new URL(url);
		if (!fullURL.searchParams.get('nextPageToken')) {
			fullURL.searchParams.set('startDate', startDate);
			fullURL.searchParams.set('endDate', endDate);
		}
		const res = await fetch(fullURL.toString(), {
			headers: {
				Authorization: `Bearer ${process.env.AXISCARE_TOKEN}`,
				'X-AxisCare-Api-Version': API_VERSION,
			},
		});
		if (!res.ok) {
			throw new Error(`API error ${res.status}: ${res.statusText}`);
		}
		const data = await res.json();
		if (!data.results) {
			console.error('No visits returned by API');
			return null;
		}
		return data.results;
	}
	catch (error) {
		console.error('Error fetching visits:', error.res?.data || error.message);
		return null;
	}
}

function hoursRunningTotal(visits, hoursMap, breakDate) {
	for (const visit of visits) {
		const rn = visit.caregiver;
		if (!rn) continue;
		const nurseName = (`${rn.firstName} ${rn.lastName}`).trim();

		const schedStart = new Date(visit.scheduledStartDate);
		const schedEnd = new Date(visit.scheduledEndDate);
		const diff = schedEnd - schedStart;
		const hours = diff / (1000 * 60 * 60);

		if (!hoursMap[nurseName]) hoursMap[nurseName] = { current: 0, next: 0 };
		
		if (isDateAfter(schedStart, breakDate)) hoursMap[nurseName].next += hours;
		else hoursMap[nurseName].current += hours;
	}
}

async function caregiverHours(start, end, breakDate) {
	const hoursMap = {};
	let nextPage = undefined;
	do {
		let results = await fetchVisits(start, end, nextPage);
		if (results) {
			let visits = results.visits;
			nextPage = results.nextPage;
			hoursRunningTotal(visits, hoursMap, breakDate);
		}
		else {
			console.error('No results returned by fetchVisits()');
			return null;
		}
	} while (nextPage && nextPage !== '');
	return hoursMap;
}

async function main() {
	console.log(`Updating list of caregivers scheduled over ${THRESHOLD} hours...`);
	const {start, end, breakDate} = getCurrentWeekRange();
	const hours = await caregiverHours(start, end, breakDate);
	if (!hours) return console.error('Unable to total caregiver hours');

	cachedOverHours = Object.entries(hours)
		.filter(([name, total]) => total.current > THRESHOLD || total.next > THRESHOLD)
		.map(([name, total]) => ({ name, total }));

	const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
	lastUpdated = `Last Updated: ${time}`;
	console.log('\x1b[32m%s\x1b[0m', `[${time}] List updated`);
}