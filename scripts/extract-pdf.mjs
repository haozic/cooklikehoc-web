import fs from 'fs';
const pdfParse = (await import('pdf-parse')).default;

const pdfData = fs.readFileSync('./老乡鸡菜谱.pdf');
const data = await pdfParse(pdfData);
console.log('Pages:', data.numpages);
console.log('Text length:', data.text.length);
console.log('---First 5000 chars---');
console.log(data.text.slice(0, 5000));
