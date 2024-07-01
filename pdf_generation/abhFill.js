const { PDFDocument } = require("pdf-lib");
const fs = require("fs");
const { fieldNameMap, fieldMaxLength } = require("./abhFieldMap");

//split string into two parts
function splitString(str, maxLength = 40) {
  //handle undefined
  if (str === undefined) {
    return { part1: "", part2: "" };
  }
  if (str.length <= maxLength) {
    return { part1: str, part2: "" };
  }

  function splitWords(str) {
    return str
      .split(/(\s|,)(?=\S)/)
      .filter(Boolean)
      .map((s) => s.trim())
      .map((word, index, arr) => {
        if (arr[index + 1] && arr[index + 1].startsWith(",")) {
          return word + ",";
        }
        return word;
      });
  }

  const words = splitWords(str);
  let currentLength = 0;
  let splitIndex = 0;

  for (let i = 0; i < words.length; i++) {
    currentLength += words[i].length + 1; // +1 for the space
    if (currentLength > maxLength) {
      splitIndex = i;
      break;
    }
  }

  return {
    part1: words.slice(0, splitIndex).join(" "),
    part2: words.slice(splitIndex).join(" "),
  };
}

//Combine the two parts with a hyphen
function combineStrings(str1, str2) {
  //handle null vals and undefined as well if both are null return empty

  if (
    (str1 === null || str1 === undefined || str1 == "") &&
    (str2 === null || str2 === undefined || str2 == "")
  ) {
    return "";
  }
  //handle null vals and if one is null return the other
  if (str1 === null || str1 === undefined || str1 == "") {
    return str2;
  }
  if (str2 === null || str2 === undefined || str2 == "") {
    return str1;
  }

  return `${str1} - ${str2}`;
}

function getNICDetails(nic) {
  let year, days, birthDay, age, gender;

  if (nic.length === 10) {
    // Old NIC format
    year = parseInt("19" + nic.substring(0, 2));
    days = parseInt(nic.substring(2, 5));
  } else if (nic.length === 12) {
    // New NIC format
    year = parseInt(nic.substring(0, 4));
    days = parseInt(nic.substring(4, 7));
  } else {
    // Invalid NIC
    const { birthDay, age, gender } = { birthDay: "", age: "", gender: "" };
    return { birthDay, age, gender };
  }

  // Determine gender
  if (days > 500) {
    gender = "Female";
    days -= 500;
  } else {
    gender = "Male";
  }

  // Determine date of birth
  const dobDate = new Date(year, 0, 1); // January 1st of the given year
  dobDate.setDate(dobDate.getDate() + days - 1);

  //format as dd/mm/yyyy
  birthDay = `${dobDate.getDate().toString().padStart(2, "0")}/${(
    dobDate.getMonth() + 1
  )
    .toString()
    .padStart(2, "0")}/${dobDate.getFullYear()}`; // Format DD/MM/YYYY

  // Calculate age
  const today = new Date();
  age = today.getFullYear() - year;
  if (
    today.getMonth() < dobDate.getMonth() ||
    (today.getMonth() === dobDate.getMonth() &&
      today.getDate() < dobDate.getDate())
  ) {
    age--;
  }

  age = age.toString();

  return { birthDay, age, gender };
}

function getNameWithInitials(fullName) {
  const nameParts = fullName.trim().split(/\s+/);
  const lastName = nameParts.pop();
  const initials =
    nameParts.map((name) => name.charAt(0).toUpperCase()).join(". ") + ".";
  return `${initials} ${lastName}`;
}

const abhFill = async (data) => {
  //pdf is in assets/
  const pdfBytes = fs.readFileSync("assets/abh-editable-version.pdf");

  const pdfDoc = await PDFDocument.load(pdfBytes);

  const form = pdfDoc.getForm();

  //split fullName
  const { part1: fullNamePart1_1, part2: fullNamePart1_2 } = splitString(
    data.fullName,
    fieldMaxLength.fullNamePart1
  );

  const { part1: fullNamePart2_1, part2: fullNamePart2_2 } = splitString(
    data.fullName,
    fieldMaxLength.fullNamePart2
  );

  const { part1: fullNamePart3_1, part2: fullNamePart3_2 } = splitString(
    data.fullName,
    fieldMaxLength.fullNamePart3
  );

  //split otherNames
  const { part1: otherNamesPart1_1, part2: otherNamesPart1_2 } = splitString(
    data.otherNames,
    fieldMaxLength.otherNamesPart1
  );

  //split otherNames
  const { part1: otherNamesPart2_1, part2: otherNamesPart2_2 } = splitString(
    data.otherNames,
    fieldMaxLength.otherNamesPart2
  );

  //split address
  const { part1: addressPart2_1, part2: addressPart2_2 } = splitString(
    data.address,
    fieldMaxLength.addressPart2
  );

  //split spouseName
  const { part1: spouseNamePart1_1, part2: spouseNamePart1_2 } = splitString(
    data.spouseName,
    fieldMaxLength.spouseNamePart1
  );

  //combine and split fatherName and fatherBirthPlace
  const {
    part1: fatherNameAndBirthPlacePart1_1,
    part2: fatherNameAndBirthPlacePart1_2,
  } = splitString(
    combineStrings(data.fatherName, data.fatherBirthPlace),
    fieldMaxLength.fatherNameAndBirthPlacePart1
  );

  //combine and split fatherFatherName and fatherFatherBirthPlace
  const {
    part1: fatherFatherNameAndBirthPlacePart1_1,
    part2: fatherFatherNameAndBirthPlacePart1_2,
  } = splitString(
    combineStrings(data.fatherFatherName, data.fatherFatherBirthPlace),
    fieldMaxLength.fatherFatherNameAndBirthPlacePart1
  );

  //combine and split motherFatherName and motherFatherBirthPlace
  const {
    part1: motherFatherNameAndBirthPlacePart1_1,
    part2: motherFatherNameAndBirthPlacePart1_2,
  } = splitString(
    combineStrings(data.motherFatherName, data.motherFatherBirthPlace),
    fieldMaxLength.motherFatherNameAndBirthPlacePart1
  );

  //combine and split lastEmployerName and lastEmployerAddress
  const {
    part1: lastEmployerNameAndAddressPart1_1,
    part2: lastEmployerNameAndAddressPart1_2,
  } = splitString(
    combineStrings(data.lastEmployerName, data.lastEmployerAddress),
    fieldMaxLength.lastEmployerNameAddressPart1
  );

  //combine and split witnessPosition and witnessAddress
  const {
    part1: witnessPositionAndAddressPart3_1,
    part2: witnessPositionAndAddressPart3_2,
  } = splitString(
    combineStrings(data.witnessPosition, data.witnessAddress),
    fieldMaxLength.witnessPositionAndAddressPart3
  );

  //combine employer and EmployerAddress
  const employerAndAddress = combineStrings(
    data.employer,
    data.employerAddress
  );

  //split motherName
  const { part1: motherNamePart1_1, part2: motherNamePart1_2 } = splitString(
    data.motherName,
    fieldMaxLength.motherNamePart1
  );

  //get from NIC
  const { birthDay, age, gender } = getNICDetails(data.nic);

  //fill fields
  form.getTextField(fieldNameMap.fullNamePart1_1).setText(fullNamePart1_1);
  form.getTextField(fieldNameMap.fullNamePart1_2).setText(fullNamePart1_2);

  form.getTextField(fieldNameMap.employerNoPart1).setText(data.employerNo);
  form
    .getTextField(fieldNameMap.epfNoPart1)
    .setText(data.epfNo ? data.epfNo.toString() : "");
  form.getTextField(fieldNameMap.otherNamesPart1_1).setText(otherNamesPart1_1);
  form.getTextField(fieldNameMap.otherNamesPart1_2).setText(otherNamesPart1_2);

  form.getTextField(fieldNameMap.addressPart1).setText(data.address);

  form.getTextField(fieldNameMap.nationalityPart1).setText(data.nationality);

  form.getTextField(fieldNameMap.sexPart1).setText(gender);

  form.getTextField(fieldNameMap.agePart1).setText(age);

  form.getTextField(fieldNameMap.birthDayPart1).setText(birthDay);
  //adjust text size of birthday to fit
  form.getTextField(fieldNameMap.birthDayPart1).setFontSize(8);

  form.getTextField(fieldNameMap.placeOfBirthPart1).setText(data.placeOfBirth);

  form
    .getTextField(fieldNameMap.marriedOrSinglePart1)
    .setText(data.marriedOrSingle);

  form.getTextField(fieldNameMap.spouseNamePart1_1).setText(spouseNamePart1_1);
  form.getTextField(fieldNameMap.spouseNamePart1_2).setText(spouseNamePart1_2);

  form
    .getTextField(fieldNameMap.nameAndBirthPlaceFatherPart1_1)
    .setText(fatherNameAndBirthPlacePart1_1);
  form
    .getTextField(fieldNameMap.nameAndBirthPlaceFatherPart1_2)
    .setText(fatherNameAndBirthPlacePart1_2);

  form.getTextField(fieldNameMap.motherNamePart1_1).setText(motherNamePart1_1);
  form.getTextField(fieldNameMap.motherNamePart1_2).setText(motherNamePart1_2);

  form
    .getTextField(fieldNameMap.nameAndBirthPlaceFatherFatherPart1_1)
    .setText(fatherFatherNameAndBirthPlacePart1_1);
  form
    .getTextField(fieldNameMap.nameAndBirthPlaceFatherFatherPart1_2)
    .setText(fatherFatherNameAndBirthPlacePart1_2);

  form
    .getTextField(fieldNameMap.nameAndBirthPlaceMotherFatherPart1_1)
    .setText(motherFatherNameAndBirthPlacePart1_1);
  form
    .getTextField(fieldNameMap.nameAndBirthPlaceMotherFatherPart1_2)
    .setText(motherFatherNameAndBirthPlacePart1_2);

  form
    .getTextField(fieldNameMap.lastEmployerNameAddressPart1_1)
    .setText(lastEmployerNameAndAddressPart1_1);
  form
    .getTextField(fieldNameMap.lastEmployerNameAddressPart1_2)
    .setText(lastEmployerNameAndAddressPart1_2);
  form.getTextField(fieldNameMap.nicPart1).setText(data.nic);

  form.getTextField(fieldNameMap.lastEmployment).setText(data.lastEmployment);
  form
    .getTextField(fieldNameMap.lastEmploymentPeriod)
    .setText(data.lastEmploymentPeriod);

  form.getTextField(fieldNameMap.employerNoPart2).setText(data.employerNo);
  form
    .getTextField(fieldNameMap.epfNoPart2)
    .setText(data.epfNo ? data.epfNo.toString() : "");

  form.getTextField(fieldNameMap.fullNamePart2_1).setText(fullNamePart2_1);
  form.getTextField(fieldNameMap.fullNamePart2_2).setText(fullNamePart2_2);

  form.getTextField(fieldNameMap.otherNamesPart2_1).setText(otherNamesPart2_1);
  form.getTextField(fieldNameMap.otherNamesPart2_2).setText(otherNamesPart2_2);

  form.getTextField(fieldNameMap.addressPart2_1).setText(addressPart2_1);
  form.getTextField(fieldNameMap.addressPart2_2).setText(addressPart2_2);

  form.getTextField(fieldNameMap.nicPart2).setText(data.nic);

  //iterate through data.nominations
  for (let i = 0; i < data.nominations.length; i++) {
    const nomination = data.nominations[i];

    const fieldNamePrefix = `nominations${i}Part2`;

    form
      .getTextField(fieldNameMap[`${fieldNamePrefix}Name`])
      .setText(nomination.name);
    form
      .getTextField(fieldNameMap[`${fieldNamePrefix}Nic`])
      .setText(nomination.nic);
    //get age from nic as nominee{index}Age
    const { age } = getNICDetails(nomination.nic);
    form.getTextField(fieldNameMap[`${fieldNamePrefix}Age`]).setText(age);
    form
      .getTextField(fieldNameMap[`${fieldNamePrefix}Relationship`])
      .setText(nomination.relationship);
    form
      .getTextField(fieldNameMap[`${fieldNamePrefix}Share`])
      .setText(
        `${nomination.share.toString()}${nomination.share !== "" ? "%" : ""}`
      );
  }

  form
    .getTextField(fieldNameMap.employerAndAddressPart2)
    .setText(employerAndAddress);

  form.getTextField(fieldNameMap.employmentPart2).setText(data.employment);
  form
    .getTextField(fieldNameMap.employedDatePart2)
    .setText(data.employedDate.replaceAll("-", "/"));
  //set basic salary as string with two decimal places
  form
    .getTextField(fieldNameMap.grossSalaryPart2)
    .setText(`Rs. ${data.grossSalary}`);

  form
    .getTextField(fieldNameMap.datePart2)
    .setText(data.date.replaceAll("-", "/"));

  form.getTextField(fieldNameMap.employerNoPart3).setText(data.employerNo);
  form
    .getTextField(fieldNameMap.epfNoPart3)
    .setText(data.epfNo ? data.epfNo.toString() : "");

  form.getTextField(fieldNameMap.fullNamePart3_1).setText(fullNamePart3_1);
  form.getTextField(fieldNameMap.fullNamePart3_2).setText(fullNamePart3_2);

  form
    .getTextField(fieldNameMap.datePart3_1)
    .setText(data.date.replaceAll("-", "/"));
  form.getTextField(fieldNameMap.datePart3_1).setFontSize(9);
  form.getTextField(fieldNameMap.witnessNamePart3_1).setText(data.witnessName);
  form
    .getTextField(fieldNameMap.namePart3)
    .setText(getNameWithInitials(data.fullName));
  form.getTextField(fieldNameMap.datePart3_2).setText(data.date);
  //set fontsize
  form.getTextField(fieldNameMap.datePart3_2).setFontSize(9);

  form.getTextField(fieldNameMap.witnessNamePart3_2).setText(data.witnessName);
  form
    .getTextField(fieldNameMap.witnessPositionAndAddressPart3_1)
    .setText(witnessPositionAndAddressPart3_1);
  form
    .getTextField(fieldNameMap.witnessPositionAndAddressPart3_2)
    .setText(witnessPositionAndAddressPart3_2);

  const pdfBytesFilled = await pdfDoc.save();

  return pdfBytesFilled;
};

module.exports = { abhFill };
