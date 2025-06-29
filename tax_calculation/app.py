from flask import Flask, render_template, request, jsonify

# --- Initialize Flask App ---
app = Flask(__name__, static_folder="static")

# --- CONSTANTS from the "Nigeria Tax Act, 2025" ---

# For PIT (Personal Income Tax)
PIT_RENT_RELIEF_PERCENTAGE = 0.20
PIT_RENT_RELIEF_CAP = 500_000
PIT_TAX_BANDS = [
    {"limit": 800_000, "rate": 0.00},
    {"limit": 2_200_000, "rate": 0.15},
    {"limit": 9_000_000, "rate": 0.18},
    {"limit": 13_000_000, "rate": 0.21},
    {"limit": 25_000_000, "rate": 0.23},
    {"limit": float('inf'), "rate": 0.25},
]

# For CIT (Company Income Tax)
CIT_SMALL_COMPANY_TURNOVER_THRESHOLD = 50_000_000
CIT_SMALL_COMPANY_FIXED_ASSETS_THRESHOLD = 250_000_000 # Added from Sec. 202
CIT_RATE_LARGE_COMPANY = 0.30
CIT_DEVELOPMENT_LEVY_RATE = 0.04

# --- BACKEND LOGIC ---

def calculate_pit_logic(data):
    """Performs the Personal Income Tax calculation."""
    # Gross Income Calculation (Section 28)
    gross_income = (
        data.get("employment_income", 0) + data.get("business_profit", 0) +
        data.get("investment_income", 0) + data.get("other_income", 0)
    )

    # Deductions Calculation (Section 30)
    rent_relief = data.get("annual_rent_paid", 0) * PIT_RENT_RELIEF_PERCENTAGE
    capped_rent_relief = min(rent_relief, PIT_RENT_RELIEF_CAP)
    total_deductions = (
        data.get("pension_contribution", 0) + data.get("nhf_contribution", 0) +
        data.get("nhis_contribution", 0) + data.get("life_insurance_premium", 0) +
        data.get("mortgage_interest", 0) + capped_rent_relief
    )

    # Chargeable Income
    chargeable_income = max(0, gross_income - total_deductions)

    # Tax Calculation (Fourth Schedule)
    tax_payable = 0.0
    income_to_tax = chargeable_income
    tax_breakdown = []
    
    # Progressive tax bands logic
    if income_to_tax > 0:
        taxable_in_band = min(income_to_tax, PIT_TAX_BANDS[0]["limit"])
        tax_on_band = taxable_in_band * PIT_TAX_BANDS[0]["rate"]
        tax_payable += tax_on_band
        income_to_tax -= taxable_in_band
        tax_breakdown.append({"band": f"First {taxable_in_band:,.2f} @ 0%", "tax": tax_on_band})
    
    for i in range(1, len(PIT_TAX_BANDS)):
        if income_to_tax <= 0: break
        band_size = PIT_TAX_BANDS[i]["limit"] - PIT_TAX_BANDS[i-1]["limit"]
        taxable_in_band = min(income_to_tax, band_size)
        tax_on_band = taxable_in_band * PIT_TAX_BANDS[i]["rate"]
        tax_payable += tax_on_band
        income_to_tax -= taxable_in_band
        tax_breakdown.append({"band": f"Next {taxable_in_band:,.2f} @ {PIT_TAX_BANDS[i]['rate']*100:.0f}%", "tax": tax_on_band})

    return {
        "gross_income": gross_income,
        "total_deductions": total_deductions,
        "chargeable_income": chargeable_income,
        "tax_payable": tax_payable,
        "tax_breakdown": tax_breakdown,
        "capped_rent_relief": capped_rent_relief
    }

def calculate_cit_logic(data):
    """Performs the Company Income Tax calculation with full rules."""
    turnover = data.get("turnover", 0)
    assessable_profit = data.get("assessable_profit", 0)
    fixed_assets = data.get("fixed_assets", 0)
    is_prof_services = data.get("is_professional_services", 0) == 1

    # Full definition of a Small Company from Section 202
    is_small_company = (
        turnover <= CIT_SMALL_COMPANY_TURNOVER_THRESHOLD and
        fixed_assets <= CIT_SMALL_COMPANY_FIXED_ASSETS_THRESHOLD and
        not is_prof_services
    )
    
    if is_small_company:
        company_income_tax = 0
        development_levy = 0
        company_type = "Small Company"
        tax_rate_percent = "0%"
        dev_levy_percent = "0%"
    else:
        company_income_tax = assessable_profit * CIT_RATE_LARGE_COMPANY
        development_levy = assessable_profit * CIT_DEVELOPMENT_LEVY_RATE
        company_type = "Medium/Large Company"
        tax_rate_percent = f"{CIT_RATE_LARGE_COMPANY:.0%}"
        dev_levy_percent = f"{CIT_DEVELOPMENT_LEVY_RATE:.0%}"
        
    total_tax = company_income_tax + development_levy
    
    return {
        "company_type": company_type,
        "assessable_profit": assessable_profit,
        "company_income_tax": company_income_tax,
        "development_levy": development_levy,
        "total_tax_payable": total_tax,
        "tax_rate_percent": tax_rate_percent,
        "dev_levy_percent": dev_levy_percent
    }


# --- FLASK ROUTES (API Endpoints) ---

@app.route('/')
def index():
    """Serves the main HTML page."""
    return render_template('index.html')

@app.route('/calculate_pit', methods=['POST'])
def calculate_pit_endpoint():
    """Endpoint for PIT calculation."""
    data = request.get_json()
    results = calculate_pit_logic(data)
    return jsonify(results)

@app.route('/calculate_cit', methods=['POST'])
def calculate_cit_endpoint():
    """Endpoint for CIT calculation."""
    data = request.get_json()
    results = calculate_cit_logic(data)
    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=True)