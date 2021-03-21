/*
const fs = require("fs")
var mime = require('mime-types')
function readFileToBase64 (url) {
  let arr = [];
  return new Promise((r, j) => {
    fs.createReadStream(url, { highWaterMark: 9999999 })
      .on('data', chunk => arr.push(chunk))
      .on('end', chunk => {
        let base64Img = "data:" + mime.lookup(url) + ";base64," + Buffer.concat(arr).toString('base64')
        r(base64Img)
      })
      .on('error', err => {
        j(err)
      })
  })

}
readFileToBase64("./a.jpg").then(r => {
  console.log('r: ', r);
})
————————————————
版权声明：本文为CSDN博主「易之晓晓」的原创文章，遵循CC 4.0 BY-SA版权协议，转载请附上原文出处链接及本声明。
原文链接：https://blog.csdn.net/qq_42306443/article/details/106430510
*/
const request = require('request-promise');
const rq = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const http = require('http')
const https = require('https')

const username = 'swiftzym'
const url = 'https://www.luogu.com.cn/api/verify/captcha'
const mod = /^https/.test(url) ? https : http

var captcha = undefined, time = 0

function findCaptcha(html) {
    var reg = new RegExp('\\d{6}');
    return reg.exec(html);
}


async function downloadCaptcha() {
    console.log("start downloading captcha");
    console.log(__dirname + '/captcha.jpg');
    try {
        const process = fs.createWriteStream(__dirname + '/captcha.jpg');
        rq({
            url: 'https://www.luogu.com.cn/api/verify/captcha' + '',
            timeout: 1500
        }).pipe(process);
    } catch (e) {
        console.log("error download captcha:", e);
    }
}

async function readCaptcha() {
    let base64str = await downloadCaptcha();
    //console.log(base64str);
    let res = await request({
        method: 'POST',
        url: 'https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=24.fc283a3d2053a73de8d8204969817a4e.2592000.1618905432.282335-23838402',
        form: {
            image: base64str,
        },
        json: true
    });
    if (res.words_result_num == 1) {
        var words = res.words_result[0].words, ans = "";
        var p = /[0-9a-zA-Z]/i;
        for (var i = 0; i < words.length; i++) {
            if (p.test(words[i])) {
                ans += words[i];
            }
        }
        if (ans.length != 4) {
            return readCaptcha();
        }
        else {
            console.log('captcha:', ans);
            return ans;
        }
    }
    else {
        return readCaptcha();
    }
}

var cache = undefined
async function getToken() {
    if (cache != undefined) {
        return cache
    }
    return new Promise(async (resolve, reject) => {
        let html = await request({
            url: 'https://www.luogu.com.cn/',
            timeout: 1500
        });
        let $ = cheerio.load(html);
        let chapters = $('meta');
        chapters.each(function (item) {
            if ($(this).attr('name') == 'csrf-token') {
                cache = $(this).attr('content');
                resolve($(this).attr('content'));
            }
        });
        reject('csrf-token not found');
    });
}

function sleep(time) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, time);
    })
};

var jar = request.jar();

async function sendEmail() {
    await getToken();
    try {
        await request({
            url: "https://www.luogu.com.cn/",
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36 Edg/89.0.774.54'
            },
            jar: jar
        });
        await sleep(1000);
        await request({
            url: "https://www.luogu.com.cn/auth/register",
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36 Edg/89.0.774.54'
            },
            jar: jar
        });
        await sleep(1000);
        console.log(jar.getCookieString('https://luogu.com.cn'))
        let res = await request({
            method: 'POST',
            url: 'https://www.luogu.com.cn/api/verify/sendVerificationCode',
            timeout: 1500,
            headers: {
                "referer": "https://www.luogu.com.cn/auth/register",
                "x-csrf-token": await getToken(),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36 Edg/89.0.774.54'
            },
            body: {
                endpoint: `${username}@lista.cc`,
                endpointType: 1,
                userExist: false,
                captcha: await readCaptcha()
            },
            json: true,
            jar: jar
        });
        console.log(res);
        console.log("send email finished");
        await sleep(10000);
    } catch (e) {
        console.log("error send email:", e);
        sendEmail();
    }
    //require('sleep').sleep(5);
}

async function updateCaptcha() {
    await sendEmail();
    try {
        let res = await request({
            method: 'GET',
            url: `https://www.snapmail.cc/emailList/${username}@lista.cc`,
            json: true,
            timeout: 5000
        });
        captcha = findCaptcha(res[res.length - 1].html)[0];
        time = res[res.length - 1].timestamp;
        console.log("new captcha:", captcha);
        console.log("new time:", time);
    } catch (e) {
        console.log("error get email:", e);
    }
}

async function tryUpdate() {
    if (Date.now() - time > 1000 * 60 * 60) await updateCaptcha();
}

try {
    tryUpdate();
} catch (e) {
    console.log("fatal error:", e);
}

//{endpoint: "swiftzym@lista.cc", endpointType: 1, captcha: "qr3d", userExist: false}
//referer: https://www.luogu.com.cn/auth/register
