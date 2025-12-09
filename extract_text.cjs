const fs = require('fs');
let pdf;
try {
    pdf = require('pdf-parse/lib/pdf-parse.js');
} catch (e) {
    console.log('Failed to require lib directly');
    try {
        pdf = require('pdf-parse');
    } catch (e2) {
        console.log('Failed to require main');
    }
}

const dataBuffer = fs.readFileSync('public/model.pdf');

if (typeof pdf === 'function') {
    pdf(dataBuffer).then(function (data) {
        console.log(data.text);
    }).catch(err => console.error(err));
} else {
    console.log('PDF function not found');
}
