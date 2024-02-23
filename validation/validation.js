function companyDetailsValidation(details) {
  if (!details.name) {
    return false;
  }
  return true;
}

module.exports = { companyDetailsValidation };
