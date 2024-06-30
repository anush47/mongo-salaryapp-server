const fs = require("fs");
const pdf = require("html-pdf");
const path = require("path");
const Handlebars = require("handlebars");
const { PDFDocument, degrees } = require("pdf-lib");
const companyModel = require("../models/companies");

// Register a helper to format address lines
Handlebars.registerHelper("formatAddress", function (address) {
  return address.split(",").join(",<br/>");
});

Handlebars.registerHelper("sum", function () {
  var args = Array.prototype.slice.call(arguments);
  //console.log(args);
  args.pop(); // Remove the Handlebars options object
  var sum = args.reduce(function (acc, value) {
    // Parse number with commas
    var num = parseFloat(value.replace(/,/g, ""));
    //set 0 if Nan
    if (isNaN(num)) {
      num = 0;
    }
    return acc + num;
  }, 0);

  // Return the sum with commas
  return sum.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
});

// Helper functions
function formatCurrency(value) {
  if (!isNaN(value) && value) {
    return parseFloat(value)
      .toFixed(2)
      .replace(/\d(?=(\d{3})+\.)/g, "$&,");
  } else {
    return "-";
  }
}

function formatPeriod(period) {
  const [year, month] = period.split("-");
  const monthName = new Date(`${year}-${month}-01`).toLocaleString("default", {
    month: "long",
  });
  return `${monthName} - ${year}`;
}

function calculateBudgetaryAndBasic(gross_salary) {
  gross_salary =
    typeof gross_salary === "string" ? parseFloat(gross_salary) : gross_salary;

  let budgetary;
  if (gross_salary <= 23500) {
    budgetary = 3500;
  } else if (gross_salary <= 42500) {
    budgetary = 2500;
  } else {
    budgetary = 0;
  }

  const basic_salary = gross_salary - budgetary;
  return { basic_salary, budgetary };
}

const generatePDF = async (
  templateName,
  company,
  monthly_details,
  payment_details,
  currencyColumns,
  additionalCalculations = () => {}
) => {
  const templatePath = path.join(
    __dirname,
    "templates",
    `${templateName}.html`
  );

  // Read the HTML template file
  const htmlTemplate = fs.readFileSync(templatePath, "utf8");

  // Compile the template using Handlebars with the runtime option to allow prototype access
  const templateCompiled = Handlebars.compile(htmlTemplate, {
    allowProtoMethodsByDefault: true,
  });

  // Filter out only the properties defined in the schema for each monthly_detail
  const monthly_details_formatted = monthly_details.map((detail) => {
    const detail_formatted = {};
    Object.keys(detail.employee._doc).forEach((key) => {
      if (key !== "monthly_details") {
        detail_formatted[`employee_${key}`] = detail.employee[key] || "";
      }
    });
    Object.keys(detail.monthly_detail._doc).forEach((key) => {
      detail_formatted[`monthly_${key}`] = detail.monthly_detail[key] || "";
    });

    detail_formatted[`monthly_epf_8`] =
      detail.monthly_detail["gross_salary"] * 0.08;
    detail_formatted[`monthly_epf_12`] =
      detail.monthly_detail["gross_salary"] * 0.12;
    detail_formatted[`monthly_etf_3`] =
      detail.monthly_detail["gross_salary"] * 0.03;

    additionalCalculations(detail, detail_formatted);

    const { basic_salary, budgetary } = calculateBudgetaryAndBasic(
      detail.monthly_detail[`gross_salary`]
    );
    detail_formatted[`monthly_basic_salary`] = basic_salary;
    detail_formatted[`monthly_budgetary_allowance`] = budgetary;
    detail_formatted[`monthly_net_pay`] =
      detail.monthly_detail[`gross_salary`] - detail_formatted["monthly_epf_8"];

    return detail_formatted;
  });

  // Calculate the sum of each numeric column
  const columnSums = {};
  monthly_details_formatted.forEach((detail) => {
    Object.entries(detail).forEach(([key, value]) => {
      if (!isNaN(value)) {
        columnSums[key] = (columnSums[key] || 0) + parseFloat(value);
      }
    });
  });

  // Add number of employees to columnSums
  columnSums.no_of_employees = monthly_details_formatted.length;

  // Format to currency
  currencyColumns.forEach((column) => {
    columnSums[column] = formatCurrency(columnSums[column]);
  });
  monthly_details_formatted.forEach((detail) => {
    currencyColumns.forEach((column) => {
      detail[column] = formatCurrency(detail[column]);
    });
  });

  // Format period
  payment_details.period = formatPeriod(payment_details.period);

  // Replace placeholders with actual dynamic values
  const filledHTMLTemplate = templateCompiled({
    company: company._doc,
    payment_details: payment_details._doc,
    monthly_details: monthly_details_formatted,
    columnSums: columnSums,
  });

  // Options for PDF generation
  const options = {
    format: "A4",
    orientation: templateName === "salary" ? "landscape" : "portrait",
  };

  // Generate PDF from filled HTML template
  return new Promise((resolve, reject) => {
    pdf.create(filledHTMLTemplate, options).toBuffer((err, buffer) => {
      if (err) {
        reject(err);
      } else {
        resolve(buffer);
      }
    });
  });
};

const generateSalaryPDF = async (company, monthly_details, payment_details) => {
  const currencyColumns = [
    "monthly_gross_salary",
    "monthly_deductions",
    "monthly_epf_8",
    "monthly_etf_3",
    "monthly_epf_12",
    "monthly_incentive",
    "monthly_allowances",
    "monthly_ot",
    "monthly_month_salary",
    "monthly_net_pay",
    "monthly_budgetary_allowance",
    "monthly_basic_salary",
  ];

  return generatePDF(
    "salary",
    company,
    monthly_details,
    payment_details,
    currencyColumns
  );
};

const generateEPFPDF = async (company, monthly_details, payment_details) => {
  const currencyColumns = [
    "monthly_gross_salary",
    "monthly_epf_8",
    "monthly_epf_12",
    "monthly_epf_20",
  ];

  const additionalCalculations = (detail, detail_formatted) => {
    detail_formatted[`monthly_epf_20`] =
      detail.monthly_detail["gross_salary"] * 0.2;
  };

  return generatePDF(
    "epf",
    company,
    monthly_details,
    payment_details,
    currencyColumns,
    additionalCalculations
  );
};

const generateETFPDF = async (company, monthly_details, payment_details) => {
  const currencyColumns = ["monthly_gross_salary", "monthly_etf_3"];

  return generatePDF(
    "etf",
    company,
    monthly_details,
    payment_details,
    currencyColumns
  );
};

const generatePaySlipPDF = async (
  company,
  monthly_details,
  payment_details,
  epf_no
) => {
  const currencyColumns = [
    "monthly_gross_salary",
    "monthly_deductions",
    "monthly_epf_8",
    "monthly_etf_3",
    "monthly_epf_12",
    "monthly_incentive",
    "monthly_allowances",
    "monthly_ot",
    "monthly_month_salary",
    "monthly_net_pay",
    "monthly_budgetary_allowance",
    "monthly_basic_salary",
  ];

  const monthly_detail = monthly_details.find(
    (detail) => detail.employee.epf_no === epf_no
  );
  monthly_details = [monthly_detail];

  return generatePDF(
    "payslip",
    company,
    monthly_details,
    payment_details,
    currencyColumns
  );
};

// Utility function to fetch details for PDF generation
const details_for_pdf = async (employer_no, period) => {
  try {
    const company = await companyModel.findOne({ employer_no });
    if (!company) {
      throw new Error("Company not found.");
    }

    const monthly_details = company.employees.map((employee) => {
      const monthlyDetail = employee.monthly_details.find(
        (detail) => detail.period === period
      );
      return { employee: employee, monthly_detail: monthlyDetail };
    });

    const payment_details = company.monthly_payments.find(
      (payment) => payment.period === period
    );

    if (!monthly_details || !payment_details) {
      throw new Error("Monthly or payment details not found.");
    }

    return { company, monthly_details, payment_details };
  } catch (error) {
    throw new Error(
      `Failed to fetch details for PDF generation: ${error.message}`
    );
  }
};

// Helper function to generate and combine payslip PDFs
async function generateCombinedPayslipPDF(
  company,
  monthly_details,
  payment_details,
  combineIntoOnePage = false
) {
  const payslipBuffers = [];

  // Get employee from monthly_details
  for (const entry of monthly_details) {
    const payslipPdfBytes = await generatePaySlipPDF(
      company,
      [entry], // Pass the relevant monthly_detail entry
      payment_details,
      entry.employee.epf_no
    );
    payslipBuffers.push(payslipPdfBytes);
  }

  // Combine all payslip PDFs into one
  const combinedPdfDoc = await PDFDocument.create();
  if (combineIntoOnePage) {
    const page = combinedPdfDoc.addPage();
    const { width, height } = page.getSize();

    for (let i = 0; i < payslipBuffers.length; i++) {
      const payslipPdfDoc = await PDFDocument.load(payslipBuffers[i]);
      const [embeddedPage] = await combinedPdfDoc.embedPages(
        payslipPdfDoc.getPages()
      );
      const xOffset = ((i % 2) * width) / 2;
      const yOffset = height - (Math.floor(i / 2) * height) / 2 - height / 2;

      page.drawPage(embeddedPage, {
        x: xOffset,
        y: yOffset,
        width: width / 2,
        height: height / 2,
      });
    }
  } else {
    for (const payslipBuffer of payslipBuffers) {
      const payslipPdfDoc = await PDFDocument.load(payslipBuffer);
      const copiedPages = await combinedPdfDoc.copyPages(
        payslipPdfDoc,
        payslipPdfDoc.getPageIndices()
      );
      copiedPages.forEach((page) => combinedPdfDoc.addPage(page));
    }
  }

  return await combinedPdfDoc.save();
}

// Function to generate all relevant PDFs and combine them
async function generateAllPDFs(
  company,
  monthly_details,
  payment_details,
  printable = false
) {
  const buffers = [];

  // Generate Salary PDF if required
  if (company.salary_sheets_required) {
    const salaryPdfBytes = await generateSalaryPDF(
      company,
      monthly_details,
      payment_details
    );
    //if printable rotate to potrait
    if (printable === true) {
      const salaryPdfDoc = await PDFDocument.load(salaryPdfBytes);
      const [page] = salaryPdfDoc.getPages();
      page.setRotation(degrees(90));
      const rotatedPdfBytes = await salaryPdfDoc.save();
      buffers.push(rotatedPdfBytes);
    } else {
      buffers.push(salaryPdfBytes);
    }
  }

  // Generate EPF PDF if required
  if (company.epf_required) {
    const epfPdfBytes = await generateEPFPDF(
      company,
      monthly_details,
      payment_details
    );
    buffers.push(epfPdfBytes);
    //if printable add two copies
    if (printable === true) {
      buffers.push(epfPdfBytes);
    }
  }

  // Generate ETF PDF if required
  if (company.etf_required) {
    const etfPdfBytes = await generateETFPDF(
      company,
      monthly_details,
      payment_details
    );
    buffers.push(etfPdfBytes);
    //if printable add two copies
    if (printable === true) {
      buffers.push(etfPdfBytes);
    }
  }

  // Generate Payslips PDF if required (printable format)
  if (company.pay_slips_required) {
    const payslipAllPrintablePdfBytes = await generateCombinedPayslipPDF(
      company,
      monthly_details,
      payment_details,
      true
    );
    buffers.push(payslipAllPrintablePdfBytes);
  }

  // Combine all generated PDFs into one document
  const combinedPdfDoc = await PDFDocument.create();
  for (const buffer of buffers) {
    const pdfDoc = await PDFDocument.load(buffer);
    const copiedPages = await combinedPdfDoc.copyPages(
      pdfDoc,
      pdfDoc.getPageIndices()
    );
    copiedPages.forEach((page) => combinedPdfDoc.addPage(page));
  }

  return await combinedPdfDoc.save();
}

module.exports = {
  generateSalaryPDF,
  generateEPFPDF,
  generateETFPDF,
  generatePaySlipPDF,
  generateCombinedPayslipPDF,
  generateAllPDFs,
  details_for_pdf,
};
