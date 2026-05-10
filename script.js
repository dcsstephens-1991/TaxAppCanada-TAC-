// --- STATE MANAGEMENT ---
let params = {
    fedBrackets: [58523, 117045, 181440, 258482],
    fedRates: [14, 20.5, 26, 29, 33],
    ontBrackets: [53891, 107785, 150000, 220000],
    ontRates: [5.05, 9.15, 11.16, 12.16, 13.16]
};

let wizardStep = 0;
const wizardData = {};
// --- QUESTION ARRAY ---
const questions = [
    { key: 'salary', label: 'What is your Annual Base Salary?', type: 'number', placeholder: '106050', icon: 'fa-money-bill-wave' },
    { key: 'nsb', label: 'Any Shift Premium? (Percentage %)', type: 'number', placeholder: '5', icon: 'fa-business-time' },
    { key: 'hourly', label: 'Base Hourly Rate?', type: 'number', placeholder: '51', icon: 'fa-clock' },
    { key: 'dcEmp', label: 'Mandatory Employee DCPP Rate (%)', type: 'number', placeholder: '4', icon: 'fa-piggy-bank' },
    { key: 'dcMatch', label: 'Employer Matching DCPP Rate (%)', type: 'number', placeholder: '4', icon: 'fa-handshake' },
    { key: 'rrspEmp', label: 'Optional RRSP Contribution Rate (%)', type: 'number', placeholder: '7', icon: 'fa-chart-line' },
    { key: 'rrspMatch', label: 'Employer RRSP Match Rate (%)', type: 'number', placeholder: '2', icon: 'fa-building-columns' },
    { key: 'fhsaVal', label: 'Annual FHSA Contribution Amount ($)', type: 'number', placeholder: '8000', icon: 'fa-house-chimney' }
];

// --- DOM SELECTORS ---
const setupWizard = document.getElementById('setupWizard');
const wizardContent = document.getElementById('wizardContent');
const mainContent = document.getElementById('mainContent');
const configModal = document.getElementById('configModal');
const breakdownList = document.getElementById('breakdownList');

// --- WIZARD LOGIC ---
function renderWizard() {
    const q = questions[wizardStep];
    wizardContent.innerHTML = `
        <div class="text-center space-y-4 animate-in fade-in duration-500">
            <div class="text-blue-500 text-5xl mb-2"><i class="fa-solid ${q.icon}"></i></div>
            <h2 class="text-xl font-bold tracking-tight">${q.label}</h2>
            <input type="number" id="wizInput" placeholder="${q.placeholder}" 
                   class="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 text-center text-3xl font-mono focus:border-blue-500 outline-none transition-all">
            <button onclick="handleWizardNext()" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-900/30">
                ${wizardStep === questions.length - 1 ? 'Finish Setup' : 'Next Question'}
            </button>
            <p class="text-[10px] text-slate-500 uppercase tracking-widest">Step ${wizardStep + 1} of ${questions.length}</p>
        </div>
    `;
    document.getElementById('wizInput').focus();
    
    // Allow 'Enter' key to advance
    document.getElementById('wizInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleWizardNext();
    });
}

function handleWizardNext() {
    const input = document.getElementById('wizInput');
    wizardData[questions[wizardStep].key] = input.value || questions[wizardStep].placeholder;

    if (wizardStep < questions.length - 1) {
        wizardStep++;
        renderWizard();
    } else {
        completeSetup();
    }
}

function completeSetup() {
    // Sync to main UI Parameter inputs
    document.getElementById('baseSalary').value = wizardData.salary;
    document.getElementById('conf_nsb').value = wizardData.nsb;
    document.getElementById('conf_hourly').value = wizardData.hourly;
    
    // Contribution sync
    document.getElementById('conf_dcEmp').value = wizardData.dcEmp;
    document.getElementById('conf_dcMatch').value = wizardData.dcMatch;
    document.getElementById('conf_rrspEmp').value = wizardData.rrspEmp;
    document.getElementById('conf_rrspMatch').value = wizardData.rrspMatch;
    document.getElementById('conf_fhsaCap').value = wizardData.fhsaVal;

    // Persist to local storage
    localStorage.setItem('tac_setup_complete', 'true');
    localStorage.setItem('tac_data', JSON.stringify(wizardData));

    // UI Transition
    setupWizard.style.opacity = '0';
    setTimeout(() => {
        setupWizard.classList.add('hidden');
        mainContent.classList.remove('locked');
        calculate();
    }, 500);
}

// --- CALCULATION ENGINE ---
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
    const salary = parseFloat(document.getElementById('baseSalary').value) || 0;
    const nsbRate = (parseFloat(document.getElementById('conf_nsb').value) || 0) / 100;
    const hourly = parseFloat(document.getElementById('conf_hourly').value) || 0;
    const dcRate = (parseFloat(document.getElementById('conf_dcEmp').value) || 0) / 100;
    const rrspRate = (parseFloat(document.getElementById('conf_rrspEmp').value) || 0) / 100;

    const nsbVal = salary * nsbRate;
    const stat = ((salary + nsbVal) / 260) * 6;
    const totalGross = salary + nsbVal + stat;

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
        { label: "Payroll (CPP/EI)", val: payroll, color: "text-rose-400" },
        { label: "Pre-Tax Savings (DC/RRSP/FHSA)", val: mySavings, color: "text-blue-400", prefix: "+" },
        { label: "Employer Compensation Match", val: (totalGross * 0.06), color: "text-emerald-400", prefix: "+" }
    ];

    breakdownList.innerHTML = items.map(item => `
        <div class="flex justify-between p-4 bg-slate-950/50 rounded-2xl border-l-4 border-slate-800">
            <span class="text-slate-500 font-medium">${item.label}</span>
            <span class="font-mono ${item.color}">${item.prefix || '-'}$${Math.abs(item.val).toLocaleString(undefined, {maximumFractionDigits:0})}</span>
        </div>
    `).join('');
}

// --- INITIALIZATION ---
window.onload = () => {
    if (localStorage.getItem('tac_setup_complete')) {
        setupWizard.classList.add('hidden');
        mainContent.classList.remove('locked');
        const saved = JSON.parse(localStorage.getItem('tac_data'));
        document.getElementById('baseSalary').value = saved.salary;
        document.getElementById('conf_nsb').value = saved.nsb;
        document.getElementById('conf_hourly').value = saved.hourly;
        document.getElementById('conf_dcEmp').value = saved.dc;
        calculate();
    } else {
        renderWizard();
    }
};

// Event Listeners for main UI
document.getElementById('settingsBtn').onclick = () => { populateTables(); configModal.classList.remove('hidden'); };
document.getElementById('closeConfig').onclick = () => configModal.classList.add('hidden');
document.getElementById('baseSalary').oninput = calculate;
document.getElementById('saveConfig').onclick = () => {
    configModal.classList.add('hidden');
    calculate();
};