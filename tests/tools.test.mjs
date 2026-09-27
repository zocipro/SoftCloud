import {test} from 'node:test';import assert from 'node:assert/strict';import {utf8Base64,fromBase64,safeLinks,imageSize,nicknames} from '../tools/shared/core.mjs';
test('UTF-8 Base64 preserves Chinese and emoji',()=>{const s='软云☁️ / hello';assert.equal(fromBase64(utf8Base64(s)),s);assert.throws(()=>fromBase64('!!!'))});
test('link extraction deduplicates and excludes script protocols',()=>{assert.deepEqual(safeLinks('文字 https://example.com/a?b=1。 https://example.com/a?b=1 javascript:alert(1)'),['https://example.com/a?b=1'])});
test('image resizing preserves aspect ratio and avoids enlargement',()=>{assert.deepEqual(imageSize(4000,2000,1920),[1920,960]);assert.deepEqual(imageSize(100,300,1920),[100,300])});
test('invisible nickname variants are distinct',()=>{const names=nicknames('软云',20);assert.equal(new Set(names).size,20);assert.ok(names.every(n=>n.startsWith('软云')));assert.equal(new Set(nicknames('',20,true)).size,20)});

test('Chinese punctuation separates a URL from surrounding prose',()=>{assert.deepEqual(safeLinks('访问 https://zoci.pro/，以及 https://words.zoci.pro/'),['https://zoci.pro/','https://words.zoci.pro/'])});
