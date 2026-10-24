/**
 * Test logic thuần cho UC16 (fallback từ khóa): bỏ dấu, tách từ, chấm điểm.
 * Chạy: npx tsx tests/ai-search.test.ts  (từ thư mục backend)
 */
import { removeDiacritics, scoreBookByTokens, tokenize } from '../src/utils/aiSearchText';

let passed = 0;
let failed = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
    console.log(`PASS ${name}`);
  } else {
    failed++;
    console.log(`FAIL ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function checkTrue(name: string, cond: boolean, detail = ''): void {
  if (cond) {
    passed++;
    console.log(`PASS ${name}`);
  } else {
    failed++;
    console.log(`FAIL ${name} ${detail}`);
  }
}

// removeDiacritics
check('bỏ dấu cơ bản', removeDiacritics('Dế Mèn phiêu lưu ký'), 'De Men phieu luu ky');
check('chu đ/Đ', removeDiacritics('Đường đời'), 'Duong doi');

// tokenize: bỏ từ dừng + từ ngắn, giữ từ có nghĩa, không trùng
check(
  'tokenize cau mo ta',
  tokenize('cuốn sách về cậu bé đi phiêu lưu'),
  ['be', 'phieu', 'luu'],
);
checkTrue('tokenize rỗng', tokenize('sách truyện').length === 0);

// scoreBookByTokens
const deMen = { title: 'Dế Mèn phiêu lưu ký', author: 'Tô Hoài', category: 'Văn học thiếu nhi' };
const tokens = tokenize('con dế đi phiêu lưu');
const hit = scoreBookByTokens(tokens, deMen);
checkTrue('De Men khớp cao', hit.score >= 50, `score=${hit.score} matched=${hit.matched}`);
checkTrue('matched chưa de + phieu + luu', ['de', 'phieu', 'luu'].every((t) => hit.matched.includes(t)));

const miss = scoreBookByTokens(tokenize('chiến tranh hạt nhân vũ trụ'), deMen);
check('sach không lien quan diem 0', miss.score, 0);

const authorHit = scoreBookByTokens(tokenize('tô hoài viết gì hay'), deMen);
checkTrue('khớp tac gia co diem', authorHit.score > 0, `score=${authorHit.score}`);

console.log(`\nTổng: ${passed} PASS, ${failed} FAIL`);
if (failed > 0) process.exit(1);
