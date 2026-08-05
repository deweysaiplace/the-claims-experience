const QRCode = require('qrcode');

const mailsorterUrl = 'http://172.20.17.161:3000';
const claimsUrl = 'http://172.20.17.161:3001';

const mailsorterPath = 'C:\\Users\\Dewey\\.gemini\\antigravity-ide\\brain\\0f2bae8f-3583-4a93-b6a3-03ea84ceb296\\mailsorter-qr.png';
const claimsPath = 'C:\\Users\\Dewey\\.gemini\\antigravity-ide\\brain\\0f2bae8f-3583-4a93-b6a3-03ea84ceb296\\claims-qr.png';

QRCode.toFile(mailsorterPath, mailsorterUrl, {
  color: {
    dark: '#000000',
    light: '#FFFFFF'
  }
}, function (err) {
  if (err) throw err;
  console.log('MailSorter QR code saved.');
});

QRCode.toFile(claimsPath, claimsUrl, {
  color: {
    dark: '#000000',
    light: '#FFFFFF'
  }
}, function (err) {
  if (err) throw err;
  console.log('Claims Experience QR code saved.');
});
