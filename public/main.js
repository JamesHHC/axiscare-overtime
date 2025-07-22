const refreshMinutes = 0.5;

async function loadData() {
	const res = await fetch('/api/overhours');
	const data = await res.json();
	const grid = document.getElementById('nurseGrid');
	const updated = document.getElementById('lastUpdated');
	grid.innerHTML = '';
	if (!data.info || data.info.length === 0) {
		grid.innerHTML = `
			<div class="text-[#43434E] border border-gray-300 bg-white rounded-md py-2 px-4 shadow text-center text-2xl font-semibold break-words flex-shrink-0 max-w-full">
				N/A
			</div>
		`;
	}
	else {
		data.info.forEach(n => {
			grid.innerHTML +=`
				<div class="text-[#43434E] border border-gray-300 bg-white rounded-md py-2 px-4 shadow text-center break-words flex-shrink-0 max-w-full">
					<p class="text-2xl font-semibold">${n.name}</p>
					<p>This week: <span class="${n.total.current > 39 ? 'font-bold text-red-600' : ''}">${n.total.current} hours</span></p>
					<p>Next week: <span class="${n.total.next > 39 ? 'font-bold text-red-600' : ''}">${n.total.next} hours</span></p>
				</div>
			`;
		});
	}
	updated.innerHTML = data.updated || 'Loading...';
}

loadData();
setInterval(loadData, refreshMinutes * 60000);