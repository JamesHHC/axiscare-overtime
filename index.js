require('dotenv').config();
const express = require('express');
var opener = require("opener");
const app = express();
const VISIT_API = `https://${process.env.AXISCARE_ID}.axiscare.com/api/visits`;
const API_VERSION = '2023-10-01';
const PORT = 2121;

const threshold = process.env.THRESHOLD;
const refreshHours = 1;
let cachedOverHours = [];

app.get('/api/overhours', (req, res) => {
	res.json(cachedOverHours);
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
	setInterval(main, refreshHours * 60 * 60 * 1000);
});

function getCurrentWeekRange() {
	const today = new Date();
	const dayOfWeek = today.getDay();

	const sunday = new Date(today);
	sunday.setDate(today.getDate() - dayOfWeek);

	const saturday = new Date(today);
	saturday.setDate(today.getDate() + (6 - dayOfWeek));

	const formatDate = (date) => `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
	return { start: formatDate(sunday), end: formatDate(saturday) };
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

function hoursRunningTotal(visits, hoursMap) {
	for (const visit of visits) {
		const rn = visit.caregiver;
		if (!rn) return;
		const nurseName = (`${rn.firstName} ${rn.lastName}`).trim();

		const schedStart = new Date(visit.scheduledStartDate);
		const schedEnd = new Date(visit.scheduledEndDate);
		const diff = schedEnd - schedStart;
		const hours = diff / (1000 * 60 * 60);

		if (!hoursMap[nurseName]) hoursMap[nurseName] = 0;
		hoursMap[nurseName] += hours;
	}
}

async function caregiverHours(start, end) {
	const hoursMap = {};
	let nextPage = undefined;
	do {
		const results = await fetchVisits(start, end, nextPage);
		if (results) {
			const visits = results.visits;
			nextPage = results.nextPage;
			hoursRunningTotal(visits, hoursMap);
		}
		else {
			console.error('No results returned by fetchVisits()');
			return null;
		}
	} while (nextPage && nextPage !== '');
	return hoursMap;
}

async function main() {
	const {start, end} = getCurrentWeekRange();
	const hours = await caregiverHours(start, end);
	if (!hours) return console.error('Unable to total caregiver hours');

	cachedOverHours = Object.entries(hours)
		.filter(([name, total]) => total > threshold)
		.map(([name, total]) => ({ name, total }));
}