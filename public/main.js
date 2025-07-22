const refreshMinutes = 1;

async function loadData() {
	const res = await fetch('/api/overhours');
	const data = await res.json();
	const grid = document.getElementById('nurseGrid');
	grid.innerHTML = '';
	data.forEach(n => {
		grid.innerHTML +=`
			<div class="text-[#43434E] border border-gray-300 bg-white rounded-md py-2 px-4 shadow text-center text-2xl font-semibold break-words flex-shrink-0 max-w-full">
				${n.name}
			</div>
		`;
	});
}

loadData();
setInterval(loadData, refreshMinutes * 60000);