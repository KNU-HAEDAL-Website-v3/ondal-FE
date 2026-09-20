/**
 * 언어별 코드 템플릿 (HOJ P3) - 편집기가 비어 있을 때 언어를 고르면 이 뼈대를 넣는다.
 * 표준 입력을 읽는 최소 골격만 - 백준식 "main 만 채우면 된다" 를 처음 쓰는 사람에게 보여 주는 용도.
 * Java 는 서버 채점기가 `Main` 클래스를 찾으므로 이름을 바꾸면 컴파일 에러가 난다.
 */
export const CODE_TEMPLATES: Readonly<Record<string, string>> = {
  C: ['#include <stdio.h>', '', 'int main(void) {', '    ', '    return 0;', '}', ''].join('\n'),
  'C++': [
    '#include <bits/stdc++.h>',
    'using namespace std;',
    '',
    'int main() {',
    '    ios::sync_with_stdio(false);',
    '    cin.tie(nullptr);',
    '    ',
    '    return 0;',
    '}',
    '',
  ].join('\n'),
  Java: [
    'import java.io.*;',
    'import java.util.*;',
    '',
    'public class Main {',
    '    public static void main(String[] args) throws IOException {',
    '        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));',
    '        ',
    '    }',
    '}',
    '',
  ].join('\n'),
  'Python 3': ['import sys', 'input = sys.stdin.readline', '', '', ''].join('\n'),
  JavaScript: ["const input = require('fs').readFileSync(0, 'utf8').trim().split('\\n');", '', ''].join('\n'),
  TypeScript: ["const input: string[] = require('fs').readFileSync(0, 'utf8').trim().split('\\n');", '', ''].join('\n'),
}

/** 그 언어의 템플릿 - 모르는 언어면 빈 문자열 */
export function codeTemplate(language: string): string {
  return CODE_TEMPLATES[language] ?? ''
}

/** 아직 손대지 않은 뼈대인가 - 비어 있거나 어느 언어의 템플릿 그대로면 언어를 바꿀 때 새 뼈대로 갈아 끼워도 잃는 게 없다 */
export function isUntouched(code: string): boolean {
  if (code.trim() === '') return true
  return Object.values(CODE_TEMPLATES).some((template) => template === code)
}
