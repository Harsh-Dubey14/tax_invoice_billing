const ones = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const tens = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function convert_hundreds(num) {
  let word = "";
  if (num > 99) {
    word += ones[Math.floor(num / 100)] + " Hundred ";
    num = num % 100;
  }
  if (num > 0) {
    if (num < 20) {
      word += ones[num];
    } else {
      word += tens[Math.floor(num / 10)];
      if (num % 10 > 0) {
        word += " " + ones[num % 10];
      }
    }
  }
  return word.trim();
}

function toWords(num) {
  if (num === 0) return "Zero";

  let result = "";

  const crore = Math.floor(num / 10000000);
  if (crore > 0) {
    result += convert_hundreds(crore) + " Crore ";
    num %= 10000000;
  }

  const lakh = Math.floor(num / 100000);
  if (lakh > 0) {
    result += convert_hundreds(lakh) + " Lakh ";
    num %= 100000;
  }

  const thousand = Math.floor(num / 1000);
  if (thousand > 0) {
    result += convert_hundreds(thousand) + " Thousand ";
    num %= 1000;
  }

  const hundred = Math.floor(num / 100);
  if (hundred > 0) {
    result += convert_hundreds(hundred * 100) + " ";
    num %= 100;
  }

  if (num > 0) {
    result += convert_hundreds(num);
  }

  return result.trim();
}

module.exports = {
  toWords,
};
