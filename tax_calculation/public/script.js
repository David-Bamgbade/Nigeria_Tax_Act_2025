// --- DYNAMIC NUMBER FORMATTING WITH COMMAS ---
document.querySelectorAll('input[type="number"]').forEach(input => {
    // This function formats the value with commas
    const formatNumber = (value) => {
        if (!value) return '';
        // Remove existing commas and non-numeric characters
        const numericValue = value.toString().replace(/,/g, '');
        // Format with commas
        return parseFloat(numericValue).toLocaleString('en-US');
    };

    // This function gets the raw numeric value without commas
    const getRawValue = (value) => {
        return value.toString().replace(/,/g, '');
    };
    
    // We change the input type to 'text' to allow commas, but keep the number pattern
    input.setAttribute('type', 'text');
    input.setAttribute('inputmode', 'decimal'); // Helps mobile users get a numeric keypad

    // Format the initial value if it exists
    if(input.value) {
        input.value = formatNumber(input.value);
    }
    
    // Add an event listener to format on input
    input.addEventListener('input', (e) => {
        const cursorPosition = e.target.selectionStart;
        const originalLength = e.target.value.length;
        
        // Get raw value and format it
        const rawValue = getRawValue(e.target.value);
        if (isNaN(parseFloat(rawValue)) && rawValue !== '') {
            // If user types non-numeric characters, remove them
            e.target.value = e.target.value.replace(/[^\d]/g, '');
        }
        const formattedValue = formatNumber(e.target.value);
        e.target.value = formattedValue;
        
        // Maintain cursor position after formatting
        const newLength = e.target.value.length;
        e.target.setSelectionRange(cursorPosition + newLength - originalLength, cursorPosition + newLength - originalLength);
    });

    // Ensure the form submits the raw numeric value, not the formatted one
    input.closest('form').addEventListener('submit', () => {
        input.value = getRawValue(input.value);
    });
});

// --- TAB SWITCHING LOGIC ---
function openTab(evt, tabName) {
    let i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
        tabcontent[i].classList.remove("active");
    }
    tablinks = document.getElementsByClassName("tab-link");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove("active");
    }
    document.getElementById(tabName).style.display = "block";
    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
    
    document.getElementById('results-area').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.tab-link.active').click();
});

// --- HELPER FUNCTION ---
const formatCurrency = (value) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(value);

// --- FORM SUBMISSION LOGIC ---
const pitForm = document.getElementById('pit-form');
const citForm = document.getElementById('cit-form');
const resultsArea = document.getElementById('results-area');
const resultsContent = document.getElementById('results-content');
const loader = document.querySelector('.loader-container');

pitForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleFormSubmit(pitForm, '/api/calculate_pit', displayPitResults);
});

citForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleFormSubmit(citForm, '/api/calculate_cit', displayCitResults);
});

async function handleFormSubmit(form, endpoint, displayFunction) {
    resultsArea.classList.remove('hidden');
    resultsContent.innerHTML = '';
    loader.style.display = 'flex';

    const formData = new FormData(form);
    const data = {};
    formData.forEach((value, key) => {
        data[key] = parseFloat(value) || 0;
    });

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const results = await response.json();
        
        setTimeout(() => {
            loader.style.display = 'none';
            displayFunction(results);
        }, 500);

    } catch (error) {
        loader.style.display = 'none';
        resultsContent.innerHTML = `<p style="color: #e53e3e; text-align: center;">An error occurred. Please check your inputs and try again.</p>`;
        console.error('Calculation Error:', error);
    }
}


// --- RESULT DISPLAY FUNCTIONS ---

function displayPitResults(data) {
    let breakdownHtml = '';
    if (data.tax_breakdown && data.tax_breakdown.length > 0) {
        data.tax_breakdown.forEach(item => {
            breakdownHtml += `<div class="tax-breakdown-item"><span>${item.band}</span><span>${formatCurrency(item.tax)}</span></div>`;
        });
    } else {
        breakdownHtml = `<div class="tax-breakdown-item"><span>No tax due on chargeable income.</span><span>${formatCurrency(0)}</span></div>`;
    }

    resultsContent.innerHTML = `
        <h3>Personal Tax Summary</h3>
        <div class="summary-grid">
            <div class="summary-item">
                <span class="label">Gross Annual Income <span class="info-icon" data-tooltip="The total income from all sources before any deductions (e.g., employment, business profit, investments).">ⓘ</span></span>
                <span class="value">${formatCurrency(data.gross_income)}</span>
            </div>
            <div class="summary-item">
                <span class="label">Chargeable Income <span class="info-icon" data-tooltip="The portion of your income that is subject to tax after all eligible deductions have been subtracted.">ⓘ</span></span>
                <span class="value">${formatCurrency(data.chargeable_income)}</span>
            </div>
            <div class="summary-item">
                <span class="label">Rent Relief (Capped) <span class="info-icon" data-tooltip="A deduction of 20% of annual rent paid, capped at ₦500,000, as per Section 30 of the Act.">ⓘ</span></span>
                <span class="value">${formatCurrency(data.capped_rent_relief)}</span>
            </div>
            <div class="summary-item">
                <span class="label">Total Deductions <span class="info-icon" data-tooltip="The sum of all your allowable reliefs (Pension, NHF, NHIS, Insurance, Mortgage Interest, and Rent Relief).">ⓘ</span></span>
                <span class="value">${formatCurrency(data.total_deductions)}</span>
            </div>
        </div>
        <div class="tax-breakdown">
            <h4>Tax Breakdown:</h4>
            ${breakdownHtml}
        </div>
        <div class="final-result">
            <span class="label">Total Annual Tax Payable</span>
            <span class="value">${formatCurrency(data.tax_payable)}</span>
        </div>
    `;
}

function displayCitResults(data) {
    resultsContent.innerHTML = `
        <h3>Company Tax Summary</h3>
        <div class="summary-grid">
            <div class="summary-item">
                <span class="label">Company Type <span class="info-icon" data-tooltip="As per Sec. 202: A 'Small Company' has a gross turnover ≤ ₦50M, total fixed assets ≤ ₦250M, and is not in professional services. It pays 0% CIT. All other companies are Medium/Large.">ⓘ</span></span>
                <span class="value">${data.company_type}</span>
            </div>
            <div class="summary-item">
                <span class="label">Assessable Profit <span class="info-icon" data-tooltip="The company's profit on which the tax rate is applied.">ⓘ</span></span>
                <span class="value">${formatCurrency(data.assessable_profit)}</span>
            </div>
            <div class="summary-item">
                <span class="label">Company Income Tax (CIT) @ ${data.tax_rate_percent}</span>
                <span class="value">${formatCurrency(data.company_income_tax)}</span>
            </div>
            <div class="summary-item">
                <span class="label">Development Levy @ ${data.dev_levy_percent} <span class="info-icon" data-tooltip="A mandatory 4% levy on the assessable profit of Medium and Large companies, per Section 59. Small companies are exempt.">ⓘ</span></span>
                <span class="value">${formatCurrency(data.development_levy)}</span>
            </div>
        </div>
        <div class="final-result">
            <span class="label">Total Annual Tax & Levy Payable</span>
            <span class="value">${formatCurrency(data.total_tax_payable)}</span>
        </div>
    `;
}