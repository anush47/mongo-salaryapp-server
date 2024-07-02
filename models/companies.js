const mongoose = require("mongoose");

const companySchema = new mongoose.Schema({
  user: { type: String, required: true },
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
  start_day: { type: String },
  start_day_by_me: { type: String },
  my_payment: { type: Number },
  employees: [
    {
      epf_no: { type: Number, required: true, unique: false },
      name: { type: String },
      designation: { type: String },
      nic: { type: String },
      active: { type: Boolean },
      divide_by: { type: Number },
      gross_salary: { type: Number },
      incentive: { type: Number },
      incentive_variation: { type: Number },
      total_salary: { type: Number },
      total_salary_variation: { type: Number },
      ot_hours_range: { type: String },
      b_card: { type: String },
      monthly_details: [
        {
          period: { type: String, required: true },
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
      period: { type: String, required: true },
      epf_reference_no: { type: String },
      epf_amount: { type: Number },
      epf_payment_method: { type: String },
      epf_cheque_no: { type: String },
      epf_collected_day: { type: String },
      epf_paid_day: { type: String },
      etf_amount: { type: Number },
      etf_payment_method: { type: String },
      etf_cheque_no: { type: String },
      etf_collected_day: { type: String },
      etf_paid_day: { type: String },
      my_payment: { type: Number },
    },
  ],
});

//index for employer_no
companySchema.index({ employer_no: 1 }, { unique: true });

//composite unique index for employer_no and employees.epf_no
companySchema.index(
  { employer_no: 1, employees: { epf_no: 1 } },
  { unique: true }
);

//composite unique index for employer_no and employees.epf_no and employees.monthly_details.period
companySchema.index(
  { employer_no: 1, employees: { epf_no: 1, monthly_details: { period: 1 } } },
  { unique: true }
);

//composite unique index for employer_no and monthly_payments.period
companySchema.index(
  { employer_no: 1, monthly_payments: { period: 1 } },
  { unique: true }
);

const companyModel = mongoose.model("companies", companySchema);

module.exports = companyModel;
