let params = {
    fedBrackets: [58523, 117045, 181440, 258482],
    fedRates: [14, 20.5, 26, 29, 33],
    ontBrackets: [53891, 107785, 150000, 220000],
    ontRates: [5.05, 9.15, 11.16, 12.16, 13.16]
};

const configModal = document.getElementById('configModal');
const settingsBtn = document.getElementById('settingsBtn');
const closeConfig = document.getElementById('closeConfig');
const baseInput = document.getElementById('baseSalary');
const breakdownList = document.getElementById('breakdownList');

function solveTax(income, bounds, rates, bpa) {
    let tax = 0; let prev = 0;
    for (let i = 0; i < bounds.length; i++) {
        if (income > prev) {
            tax += (Math.min(income, bounds[i]) - prev) * (rates[i] / 100);
            prev = bounds[i];
        }
    }
    if (income > prev) tax += (income - prev) * (rates[rates.length - 1] / 100);
    return Math.max(0, tax - (bpa * (rates[0] / 100)));
}

function calculate() {
    const salary = parseFloat(baseInput.value) || 0;
    const hourly = parseFloat(document.getElementById('conf_hourly').value) || 0;
    const dcRate = (parseFloat(document.getElementById('conf_dcEmp').value) || 0) / 100;
    const rrspRate = (parseFloat(document.getElementById('conf_rrspEmp').value) || 0) / 100;

    const nsb = salary * 0.05;
    const stat = ((salary + nsb) / 260) * 6;
    const totalGross = salary + nsb + stat;

    const mySavings = (totalGross * dcRate) + (totalGross * rrspRate) + 8000;
    const taxable = Math.max(0, totalGross - mySavings);

    const fedTax = solveTax(taxable, params.fedBrackets, params.fedRates, 16452);
    const ontBase = solveTax(taxable, params.ontBrackets, params.ontRates, 12989);
    const ontTotal = ontBase + (Math.max(0, (ontBase - 6000) * 0.2) + Math.max(0, (ontBase - 7671) * 0.36));

    const payroll = Math.min(totalGross * 0.0163, 1123.07) + (Math.min(Math.max(0, totalGross - 3500) * 0.0595, 4230.45) + Math.min(Math.max(0, totalGross - 74600) * 0.04, 416));
    
    const netPay = taxable - fedTax - ontTotal - payroll;

    document.getElementById('displayGross').innerText = `$${totalGross.toLocaleString(undefined, {maximumFractionDigits:0})}`;
    document.getElementById('displayNet').innerText = `$${netPay.toLocaleString(undefined, {maximumFractionDigits:0})}`;
    
    const fRoom = (params.fedBrackets.find(b => b > taxable) || 258482) - taxable;
    const oRoom = (params.ontBrackets.find(b => b > taxable) || 220000) - taxable;
    const otHoursVal = (Math.min(fRoom, oRoom) / (1 - (dcRate + rrspRate))) / (hourly * 1.5);
    document.getElementById('otHours').innerText = Math.floor(otHoursVal);

    const items = [
        { label: "Federal Income Tax", val: fedTax, color: "text-rose-400" },
        { label: "Ontario Provincial Tax", val: ontTotal, color: "text-rose-400" },
        { label: "CPP & EI Contributions", val: payroll, color: "text-rose-400" },
        { label: "Your Pre-Tax Savings", val: mySavings, color: "text-blue-400", prefix: "+" },
        { label: "Employer Match Value", val: (totalGross * 0.06), color: "text-emerald-400", prefix: "+" }
    ];

    breakdownList.innerHTML = items.map(item => `
        <div class="flex justify-between p-4 bg-slate-950/50 rounded-2xl border-l-4 border-slate-800">
            <span class="text-slate-500 font-medium">${item.label}</span>
            <span class="font-mono ${item.color}">${item.prefix || '-'}$${Math.abs(item.val).toLocaleString(undefined, {maximumFractionDigits:0})}</span>
        </div>
    `).join('');
}

function populateTables() {
    const renderRow = (b, r, i, color) => `
        <tr class="border-t border-slate-800">
            <td class="p-4"><input type="number" value="${b}" class="config-input w-28 text-center ${color}-b"></td>
            <td class="p-4"><input type="number" value="${r}" class="config-input w-20 text-center ${color}-r"><span class="ml-2 text-slate-500">%</span></td>
        </tr>`;
    
    document.getElementById('fedTableBody').innerHTML = params.fedBrackets.map((b, i) => renderRow(b, params.fedRates[i], i, 'fed')).join('') + renderRow('Max', params.fedRates[4], 4, 'fed');
    document.getElementById('ontTableBody').innerHTML = params.ontBrackets.map((b, i) => renderRow(b, params.ontRates[i], i, 'ont')).join('') + renderRow('Max', params.ontRates[4], 4, 'ont');
}

settingsBtn.onclick = () => { populateTables(); configModal.classList.remove('hidden'); };
closeConfig.onclick = () => configModal.classList.add('hidden');
baseInput.oninput = calculate;
document.getElementById('saveConfig').onclick = () => {
    document.querySelectorAll('.fed-b').forEach((el, i) => { if(i < 4) params.fedBrackets[i] = parseFloat(el.value) });
    document.querySelectorAll('.fed-r').forEach((el, i) => params.fedRates[i] = parseFloat(el.value));
    document.querySelectorAll('.ont-b').forEach((el, i) => { if(i < 4) params.ontBrackets[i] = parseFloat(el.value) });
    document.querySelectorAll('.ont-r').forEach((el, i) => params.ontRates[i] = parseFloat(el.value));
    configModal.classList.add('hidden');
    calculate();
};

calculate();