// --- CONFIGURATION DATA ---
const CONFIG = {
    params: {
        fedBrackets: [58523, 117045, 181440, 258482],
        fedRates: [14, 20.5, 26, 29, 33],
        ontBrackets: [53891, 107785, 150000, 220000],
        ontRates: [5.05, 9.15, 11.16, 12.16, 13.16],
        bpa: { fed: 16452, ont: 12989 }
    },
    payroll: {
        eiRate: 0.0163, eiMax: 1123.07,
        cppRate: 0.0595, cppMax: 4230.45,
        cpp2Rate: 0.04, cpp2Max: 416,
        cppThreshold: 3500, cpp2Threshold: 74600
    }
};

const formatter = new Intl.NumberFormat('en-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 2
});

let userProfile = {};
let currentStep = 'WELCOME';
let wizardHistory = [];
let questionQueue = []; 

// --- WIZARD FLOW DEFINITION ---
const wizardFlow = {
    WELCOME: {
        title: "to T.A.C",
        desc: "Select your employment type to begin.",
        type: 'choice',
        options: [
            { label: 'Standard Salary', val: 'SALARY', next: 'INCOME_ANNUAL' },
            { label: 'Hourly / Shift Work', val: 'HOURLY', next: 'INCOME_HOURLY' }
        ]
    },
    INCOME_ANNUAL: { title: "Annual Salary", desc: "Gross annual base salary?", type: 'number', key: 'baseAnnual', next: 'PENSION_CHECK' },
    INCOME_HOURLY: { title: "Pay Rate", desc: "Base hourly rate?", type: 'number', key: 'hourlyRate', next: 'SHIFT_HUB' },
    
    // NEW GRID HUB: Groups Shift Premium parameters together
    SHIFT_HUB: {
        title: "Shift Configuration",
        desc: "Set your premium and hour application.",
        type: 'grid',
        fields: [
            { key: 'nsbRate', label: 'Premium %', placeholder: '5', unit: '%' },
            { key: 'hoursPerWeek', label: 'Hours/Week', placeholder: '37.5', unit: 'hrs' },
            { key: 'premiumApplyAll', label: 'Apply to All Hours?', type: 'toggle', unit: 'Y/N' },
            { key: 'premiumHourCap', label: 'Premium Cap', placeholder: '37.5', unit: 'hrs' }
        ],
        next: 'STAT_HOLIDAYS'
    },

    SHIFT_PREMIUM: { title: "Shift Premium", desc: "Percentage (0 if none)", type: 'number', key: 'nsbRate', next: 'STAT_HOLIDAYS' },
    STAT_HOLIDAYS: { title: "Stat Holidays", desc: "Annual paid stat holidays?", type: 'number', key: 'statDays', placeholder: '6', next: 'PENSION_CHECK' },
    PENSION_CHECK: {
        title: "Pension Plan",
        desc: "Do you have a retirement program?",
        type: 'choice',
        options: [
            { label: 'Yes, I have benefits', val: true, next: 'PENSION_TYPE' },
            { label: 'No employer benefits', val: false, next: 'FHSA_TYPE' }
        ]
    },
    PENSION_TYPE: {
        title: "Employer Benefits",
        desc: "Select all that apply:",
        type: 'checkbox',
        options: [
            { label: 'Defined Contribution (DC)', key: 'hasDC', nextBranch: 'DC_EMP_RATE' },
            { label: 'Defined Benefit (DB)', key: 'hasDB', nextBranch: 'DB_RATE' },
            { label: 'Group RRSP Match', key: 'hasRRSP', nextBranch: 'RRSP_EMP_RATE' },
            { label: 'TFSA Matching', key: 'hasTFSA', nextBranch: 'TFSA_RATE' },
            { label: 'Profit Sharing (EPSP)', key: 'hasEPSP', nextBranch: 'EPSP_RATE' }
        ]
    },
    // BRANCH: DC
    DC_EMP_RATE: { title: "DCPP Rate", desc: "Your contribution (%)", type: 'number', key: 'dcEmp', next: 'DC_AUTO_RATE' },
    DC_AUTO_RATE: { title: "Employer Base", desc: "Auto contribution (%)", type: 'number', key: 'dcAuto', next: 'DC_MATCH_RATE' },
    DC_MATCH_RATE: { title: "Employer Match", desc: "Matching rate (%)", type: 'number', key: 'dcMatch', next: 'QUEUE_PROCESSOR' },
    
    DB_RATE: { title: "DB Deduction", desc: "Your deduction rate (%)", type: 'number', key: 'dbRate', next: 'QUEUE_PROCESSOR' },
    
    RRSP_EMP_RATE: { title: "RRSP Rate", desc: "Your contribution (%)", type: 'number', key: 'rrspEmp', next: 'RRSP_MATCH_RATE' },
    RRSP_MATCH_RATE: { title: "RRSP Match", desc: "Employer match (%)", type: 'number', key: 'rrspMatch', next: 'QUEUE_PROCESSOR' },

    TFSA_RATE: { title: "TFSA Match", desc: "Employer TFSA match (%)", type: 'number', key: 'tfsaMatch', next: 'QUEUE_PROCESSOR' },
    EPSP_RATE: { title: "Profit Sharing", desc: "Annual EPSP (%)", type: 'number', key: 'epspRate', next: 'QUEUE_PROCESSOR' },

    FHSA_TYPE: {
        title: "FHSA Setup",
        desc: "Contribution type?",
        type: 'choice',
        options: [
            { label: 'Flat Annual Amount ($)', val: 'FLAT', next: 'FHSA_VAL' },
            { label: 'Percentage of Gross (%)', val: 'PERCENT', next: 'FHSA_VAL' }
        ]
    },
    FHSA_VAL: { title: "FHSA Value", desc: "Enter amount or percentage:", type: 'number', key: 'fhsaVal', next: 'FINISH' },
    FINISH: { title: "All Set!", desc: "Your profile is saved locally.", type: 'final' }
};

// --- WIZARD RENDERER ---
function renderWizard() {
    const step = wizardFlow[currentStep];
    const container = document.getElementById('wizardContent');

    const headerHtml = currentStep === 'WELCOME' 
        ? `<h2 class="text-3xl font-black mb-2"><span class="gradient-text">Welcome</span> to T.A.C</h2>`
        : `<h2 class="text-3xl font-black mb-2 text-white">${step.title}</h2>`;

    let html = `<div class="animate-in fade-in zoom-in duration-500 text-center">${headerHtml}<p class="text-slate-500 text-sm mb-8">${step.desc}</p>`;

    if (step.type === 'choice') {
        html += `<div class="space-y-3">` + step.options.map(opt => `
            <button onclick="handleChoice('${opt.next}', '${opt.val}')" class="choice-btn group">
                <span class="font-bold group-hover:text-blue-400 transition-colors">${opt.label}</span>
                <i class="fa-solid fa-chevron-right text-slate-700 group-hover:text-blue-500 text-xs"></i>
            </button>`).join('') + `</div>`;
    } else if (step.type === 'grid') {
        // RENDER 2x2 GRID
        html += `<div class="grid grid-cols-2 gap-4 mb-6">` + step.fields.map(f => `
            <div class="bg-slate-950 border border-slate-800 p-4 rounded-2xl">
                <label class="text-[10px] font-bold text-slate-500 uppercase block mb-2">${f.label}</label>
                <div class="flex items-center justify-center gap-2">
                    <input type="${f.type === 'toggle' ? 'checkbox' : 'number'}" 
                           id="grid_${f.key}" 
                           class="${f.type === 'toggle' ? 'w-6 h-6 rounded bg-slate-900 border-slate-700' : 'w-full bg-transparent text-center text-xl font-mono outline-none text-white'}"
                           placeholder="${f.placeholder || '0'}">
                    <span class="text-[10px] text-slate-600 font-mono">${f.unit}</span>
                </div>
            </div>
        `).join('') + `</div>
        <button onclick="handleGridNext()" class="w-full bg-blue-600 hover:bg-blue-500 font-bold py-4 rounded-2xl transition-all">Continue</button>`;
    } else if (step.type === 'checkbox') {
        html += `<div class="space-y-3 text-left">` + step.options.map(opt => `
            <label class="flex items-center p-4 bg-slate-950 border border-slate-800 rounded-2xl cursor-pointer hover:border-blue-500 transition-all group">
                <input type="checkbox" class="wiz-checkbox w-5 h-5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500" data-next="${opt.nextBranch}">
                <span class="ml-4 font-bold text-slate-200 group-hover:text-blue-400 transition-colors">${opt.label}</span>
            </label>`).join('') + `</div><button onclick="handleCheckboxNext()" class="w-full bg-blue-600 hover:bg-blue-500 font-bold py-4 rounded-2xl mt-6 transition-all">Continue</button>`;
    } else if (step.type === 'number') {
        let symbol = step.key === 'fhsaVal' ? (userProfile['FHSA_TYPE'] === 'PERCENT' ? '%' : '$') : 
                     (step.key.toLowerCase().match(/rate|premium|percent|emp|match|auto/) ? '%' : '$');

        html += `<div class="relative group">
                    <input type="number" id="wizInput" value="${userProfile[step.key] || ''}" placeholder="${step.placeholder || '0'}" class="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 text-center text-3xl font-mono focus:border-blue-500 outline-none mb-6 text-white">
                    <span class="absolute right-6 top-5 text-slate-600 font-mono text-xl pointer-events-none group-focus-within:text-blue-500 transition-colors">${symbol}</span>
                 </div><button onclick="handleNumberNext()" class="w-full bg-blue-600 hover:bg-blue-500 font-bold py-4 rounded-2xl transition-all">Continue</button>`;
    } else if (step.type === 'final') {
        html += `<button onclick="completeSetup()" class="w-full bg-green-600 hover:bg-green-500 font-bold py-4 rounded-2xl shadow-lg shadow-green-900/20">Open Dashboard</button>`;
    }

    if (wizardHistory.length > 0) {
        html += `<button onclick="handleBack()" class="mt-6 text-slate-500 hover:text-slate-300 text-xs uppercase font-bold tracking-widest transition-all"><i class="fa-solid fa-arrow-left mr-2"></i> Back</button>`;
    }

    html += `</div>`;
    container.innerHTML = html;
}

// --- LOGIC HANDLERS ---
function handleChoice(next, val) {
    wizardHistory.push(currentStep);
    userProfile[currentStep] = val;
    currentStep = next;
    renderWizard();
}

function handleGridNext() {
    const step = wizardFlow[currentStep];
    wizardHistory.push(currentStep);
    step.fields.forEach(f => {
        const el = document.getElementById(`grid_${f.key}`);
        userProfile[f.key] = f.type === 'toggle' ? el.checked : parseFloat(el.value) || 0;
    });
    currentStep = step.next;
    renderWizard();
}

function handleCheckboxNext() {
    const selected = document.querySelectorAll('.wiz-checkbox:checked');
    questionQueue = Array.from(selected).map(cb => cb.getAttribute('data-next'));
    wizardHistory.push(currentStep);
    processQueue();
}

function processQueue() {
    currentStep = questionQueue.length > 0 ? questionQueue.shift() : 'FHSA_TYPE';
    renderWizard();
}

function handleNumberNext() {
    const step = wizardFlow[currentStep];
    const val = document.getElementById('wizInput').value;
    wizardHistory.push(currentStep);
    userProfile[step.key] = parseFloat(val) || 0;
    
    if (step.next === 'QUEUE_PROCESSOR') {
        processQueue();
    } else {
        currentStep = step.next;
        renderWizard();
    }
}

function handleBack() {
    currentStep = wizardHistory.pop();
    renderWizard();
}

function completeSetup() {
    localStorage.setItem('tac_user_profile', JSON.stringify(userProfile));
    document.getElementById('setupWizard').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('locked');
    calculate();
}

// --- TAX CALC ENGINE ---
function calculate() {
    const profile = JSON.parse(localStorage.getItem('tac_user_profile')) || {};
    const breakdownList = document.getElementById('breakdownList');

    // GROSS CALCULATION
    let baseAnnual = profile.baseAnnual || (profile.hourlyRate * (profile.hoursPerWeek || 37.5) * 52);
    
    // PREMIUM LOGIC: All hours vs Capped Hours
    let nsb = 0;
    if (profile.premiumApplyAll) {
        nsb = baseAnnual * (profile.nsbRate / 100);
    } else {
        // Apply premium only to capped hours (e.g. 37.5) per week
        nsb = (profile.hourlyRate * (profile.premiumHourCap || 37.5) * (profile.nsbRate / 100)) * 52;
    }

    const stat = ((baseAnnual + nsb) / 260) * (profile.statDays || 0);
    const totalGross = baseAnnual + nsb + stat;

    // DEDUCTIONS
    const dcDed = totalGross * (profile.dcEmp / 100 || 0);
    const rrspDed = totalGross * (profile.rrspEmp / 100 || 0);
    const dbDed = totalGross * (profile.dbRate / 100 || 0);
    const fhsaDed = profile.FHSA_TYPE === 'FLAT' ? profile.fhsaVal : (totalGross * (profile.fhsaVal / 100));
    
    const taxableIncome = Math.max(0, totalGross - (dcDed + rrspDed + dbDed + fhsaDed));

    // TAXES
    const fedTax = solveTax(taxableIncome, CONFIG.params.fedBrackets, CONFIG.params.fedRates, CONFIG.params.bpa.fed);
    const ontBase = solveTax(taxableIncome, CONFIG.params.ontBrackets, CONFIG.params.ontRates, CONFIG.params.bpa.ont);
    const ontTotal = ontBase + (Math.max(0, (ontBase - 6000) * 0.2) + Math.max(0, (ontBase - 7671) * 0.36));
    
    const ei = Math.min(totalGross * CONFIG.payroll.eiRate, CONFIG.payroll.eiMax);
    const cpp = Math.min(Math.max(0, totalGross - CONFIG.payroll.cppThreshold) * CONFIG.payroll.cppRate, CONFIG.payroll.cppMax) + Math.min(Math.max(0, totalGross - CONFIG.payroll.cpp2Threshold) * CONFIG.payroll.cpp2Rate, CONFIG.payroll.cpp2Max);
    
    const netPay = taxableIncome - fedTax - ontTotal - ei - cpp;

    document.getElementById('displayGross').innerText = formatter.format(totalGross);
    document.getElementById('displayNet').innerText = formatter.format(netPay);
    
    const items = [
        { label: "Federal Income Tax", val: fedTax, color: "text-rose-400" },
        { label: "Ontario Provincial Tax", val: ontTotal, color: "text-rose-400" },
        { label: "CPP & EI Premiums", val: ei + cpp, color: "text-rose-400" },
        { label: "Total Savings Contributions", val: (dcDed + rrspDed + dbDed + fhsaDed), color: "text-blue-400", prefix: "+" },
        { label: "Employer Match Value", val: (totalGross * (profile.dcAuto / 100 || 0)) + (totalGross * (profile.dcMatch / 100 || 0)) + (totalGross * (profile.rrspMatch / 100 || 0)), color: "text-emerald-400", prefix: "+" }
    ];

    breakdownList.innerHTML = items.map(item => `
        <div class="flex justify-between p-4 bg-slate-950/50 rounded-2xl border-l-4 border-slate-800">
            <span class="text-slate-500 font-medium">${item.label}</span>
            <span class="font-mono ${item.color}">${item.prefix || '-'}${formatter.format(Math.abs(item.val))}</span>
        </div>`).join('');
}

function solveTax(income, bounds, rates, credit) {
    let tax = 0; let prev = 0;
    for (let i = 0; i < bounds.length; i++) {
        if (income > prev) {
            tax += (Math.min(income, bounds[i]) - prev) * (rates[i] / 100);
            prev = bounds[i];
        }
    }
    if (income > prev) tax += (income - prev) * (rates[rates.length - 1] / 100);
    return Math.max(0, tax - (credit * (rates[0] / 100)));
}

function resetProfile() {
    localStorage.removeItem('tac_user_profile');
    location.reload();
}

window.onload = () => {
    if (localStorage.getItem('tac_user_profile')) {
        document.getElementById('setupWizard').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('locked');
        calculate();
    } else {
        renderWizard();
    }
};