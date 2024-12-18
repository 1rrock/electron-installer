const fs = require("fs");
const path = require('path');

const engName = 'YBM_HIGHcultureenglish';

function getBookJsMeta() {
    // const filePath = `/e-abr/book/book.js`;
    const filePath =  path.join(__dirname, 'e-abr', 'book', 'book.js')// `/e-abr/book/book.js`;

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const cleanedContent = fileContent.replace(/(?!\/\*{ABR\*\/)(?!\/\*ABR\}\*\/)(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g, '');
    const jsonMatch = cleanedContent.match(/abr\.cfgBook\s*=\s*\/\*{ABR\*\/\s*(\{[\s\S]*?\})\s*\/\*ABR\}\*\//);
    if (jsonMatch && jsonMatch[1]) {
        try {
            // 추출한 JSON 문자열을 JavaScript 객체로 변환
            const config = JSON.parse(jsonMatch[1]);
            return config.meta;
        } catch (error) {
            console.log('JSON 파싱 에러:', error);
            return null;
        }
    } else {
        console.log('JSON을 찾을 수 없습니다.');
        return null;
    }
}

// package.json 수정 함수
function updatePackageJson() {
    const meta = getBookJsMeta();



    // nsh파일 수정
    const nshFilePath = path.join(__dirname, 'build', 'installer.nsh');
    let nshContent = fs.readFileSync(nshFilePath, 'utf-8');

    // 정규식으로 숫자 패턴을 찾아서 meta.id로 교체
    nshContent = nshContent.replace(
        /DeleteRegKey SHELL_CONTEXT Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\d+/,
        `DeleteRegKey SHELL_CONTEXT Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${meta.id}`
    );
    console.log(nshContent)
    fs.writeFileSync(nshFilePath, nshContent, 'utf-8');
    // nsh파일 수정 end

    // package.json 수정
    const packageJsonPath = path.resolve(__dirname, 'package.json');

    // package.json 파일 읽기
    let packageJson;
    try {
        packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    } catch (err) {
        console.error("Error reading package.json:", err);
        // process.exit(1);
    }

    // package.json 수정
    packageJson.name = engName;
    packageJson.build = packageJson.build || {};
    packageJson.build.productName = meta.title;
    packageJson.build.appId = meta.id;
    packageJson.build.nsis.guid = meta.id;

    // 수정된 package.json 파일 다시 쓰기
    try {
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
        console.log("package.json updated successfully!");
    } catch (err) {
        console.error("Error writing package.json:", err);
        // process.exit(1);
    }
}

// 함수 호출
updatePackageJson();

