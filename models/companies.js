const mongoose = require("mongoose");

const companySchema = new mongoose.Schema();

// Add fields to the schema in the desired order
companySchema.add({
  name: { type: String, required: true },
  employer_no: { type: String, required: true, unique: true },
  address: { type: String },
  active: { type: Boolean },
  epf_required: { type: Boolean },
  etf_required: { type: Boolean },
  salary_sheets_required: { type: Boolean },
  pay_slips_required: { type: Boolean },
  default_epf_payment_method: { type: String },
  default_etf_payment_method: { type: String },
  start_day: { type: Date },
  start_day_by_me: { type: Date },
  employees: [
    {
      epf_no: { type: Number },
      name: { type: String },
      nic: { type: String },
      active: { type: Boolean },
      divide_by: { type: Number },
      gross_salary: { type: Number },
      total_salary: { type: Number },
      monthly_details: [
        {
          period: { type: Date },
          ot: { type: Number },
          ot_y: { type: String },
          allowances: { type: Number },
          incentive: { type: Number },
          deductions: { type: Number },
          deductions_y: { type: String },
          month_salary: { type: Number },
        },
      ],
    },
  ],
  monthly_payments: [
    {
      period: { type: Date },
      //epf
      epf_reference_no: { type: String },
      epf_amount: { type: Number },
      epf_payment_method: { type: String },
      epf_cheque_no: { type: String },
      epf_collected_day: { type: Date },
      epf_paid_day: { type: Date },
      //etf
      etf_amount: { type: Number },
      etf_payment_method: { type: String },
      etf_cheque_no: { type: String },
      etf_collected_day: { type: Date },
      etf_paid_day: { type: Date },
      my_payment: { type: Number },
    },
  ],
});

const companyModel = mongoose.model("companies", companySchema);

module.exports = companyModel;
