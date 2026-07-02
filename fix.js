const fs = require('fs');
const cp = require('child_process');

let code = fs.readFileSync('app.js', 'utf8');
let lines = code.split('\n');
let maxIterations = 200;

for (let i = 0; i < maxIterations; i++) {
    fs.writeFileSync('app.js', lines.join('\n'));
    try {
        cp.execSync('node -c app.js', { stdio: 'pipe' });
        console.log('Syntax is valid!');
        break;
    } catch (err) {
        let stderr = err.stderr ? err.stderr.toString() : '';
        let match = stderr.match(/app\.js:(\d+)/);
        if (match) {
            let lineNum = parseInt(match[1], 10) - 1;
            let line = lines[lineNum];
            let sqCount = (line.match(/'/g) || []).length;
            let dqCount = (line.match(/"/g) || []).length;
            let bqCount = (line.match(/`/g) || []).length;
            
            if (line.includes('??;')) {
                lines[lineNum] = line.replace('??;', '\'??\';');
            } else if (line.includes('??,')) {
                lines[lineNum] = line.replace('??,', '\'??\',');
            } else if (sqCount % 2 !== 0) {
                if (line.trim().endsWith(';')) lines[lineNum] = line.replace(/;$/, '\';');
                else if (line.trim().endsWith(',')) lines[lineNum] = line.replace(/,$/, '\',');
                else lines[lineNum] = line + '\'';
            } else if (dqCount % 2 !== 0) {
                if (line.trim().endsWith(';')) lines[lineNum] = line.replace(/;$/, '";');
                else if (line.trim().endsWith(',')) lines[lineNum] = line.replace(/,$/, '",');
                else lines[lineNum] = line + '"';
            } else if (bqCount % 2 !== 0) {
                if (line.trim().endsWith(';')) lines[lineNum] = line.replace(/;$/, '`;');
                else if (line.trim().endsWith(',')) lines[lineNum] = line.replace(/,$/, '`,');
                else lines[lineNum] = line + '`';
            } else {
                lines[lineNum] = line.replace('??', '\'??\'');
            }
            console.log('Fixed line ' + (lineNum + 1) + ': ' + lines[lineNum]);
        } else {
            console.log('Could not parse error:', stderr);
            break;
        }
    }
}
