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
      incentive: { type: Number },
      incentive_variation: { type: Number },
      total_salary: { type: Number },
      total_variation: { type: Number },
      ot_hours_range: { type: String }, // "10-20"
      monthly_details: [
        {
          period: { type: String, unique: true },
          gross_salary: { type: Number },
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
      period: { type: Date, unique: true },
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

// Indexes for unique `period` in `monthly_details` array for each employee
companySchema.index(
  { "employees.monthly_details.period": 1 },
  { unique: true }
);

// Index for unique `period` in `monthly_payments` array for the company schema
companySchema.index({ "monthly_payments.period": 1 }, { unique: true });

const companyModel = mongoose.model("companies", companySchema);

module.exports = companyModel;
