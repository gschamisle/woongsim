'use strict';
// ─────────────────────────────────────────────
// 밸런스 데이터: 난이도 · 캐릭터 · 스테이지
// 수치만 고치면 조정되도록 한곳에 모아둔다.
// ─────────────────────────────────────────────

// 캐릭터 능력 (창작 설정 — 공식 설정 아님). 난이도와 무관하게 고정.
const CHARS = {
  woong: {
    id: 'woong', name: '웅심이', speed: 74, dribble: 0.92,
    chargeTime: 0.78, quickPow: 285, maxPow: 470, kickDelay: 0.07,
    ballDist: 5, shield: true, lureMul: 1.35, radius: 6,
    blurb: '강한 슛 · 안정적인 볼 운반(태클 1회 버티기) · 수비를 잘 끌어당김',
  },
  ong: {
    id: 'ong', name: '옹심이', speed: 90, dribble: 0.94,
    chargeTime: 0.36, quickPow: 300, maxPow: 390, kickDelay: 0.0,
    ballDist: 6, shield: false, lureMul: 1.0, radius: 5,
    blurb: '빠른 이동 · 짧은 슛 준비 시간 · 빈 공간 침투',
  },
};

const DIFFS = {
  easy: {
    key: 'easy', name: '쉬움', sub: '첫 직관', time: 120, color: '#6cc04a',
    desc: '느린 추격, 넉넉한 빈 공간', defSpeed: 0.70, tell: 0.8, oneTwo: 0.9,
    gkReact: 0.36, gkSpeed: 58, gkDive: 150, gkReach: 18, gkBody: 6,
    intercept: 3.5, pressR: 66, react: 0.55, recover: 1.15, lean: 0.35, leanPenalty: 0.16,
    maxDefs: 3,
  },
  normal: {
    key: 'normal', name: '보통', sub: '나르샤', time: 100, color: C.yellow,
    desc: '추격과 패스 차단 혼합', defSpeed: 0.84, tell: 0.6, oneTwo: 0.65,
    gkReact: 0.25, gkSpeed: 76, gkDive: 185, gkReach: 22, gkBody: 7,
    intercept: 4.5, pressR: 86, react: 0.38, recover: 0.9, lean: 0.55, leanPenalty: 0.18,
    maxDefs: 4,
  },
  hard: {
    key: 'hard', name: '어려움', sub: '원정석 코어', time: 85, color: C.orange,
    desc: '압박과 차단을 적극 조합', defSpeed: 0.95, tell: 0.45, oneTwo: 0.45,
    gkReact: 0.17, gkSpeed: 94, gkDive: 225, gkReach: 26, gkBody: 7,
    intercept: 5.5, pressR: 104, react: 0.26, recover: 0.7, lean: 0.85, leanPenalty: 0.22,
    maxDefs: 4,
  },
};
const DIFF_KEYS = ['easy', 'normal', 'hard'];

// 공통 게임 수치
const TUNE = {
  passSpeed: 255, passMin: 0.16, guPass: 1.3, guShot: 1.15, guTime: 6,
  defBase: 72, tackleRange: 19, lungeSpeed: 185, lungeTime: 0.22,
  receiveR: 9, graceAfterRecv: 0.4, oneTwoMemory: 4.0,
  failPause: 1.25, goalPause: 2.5, readyTime: 0.9,
  stage5Penalty: 5,
};

// 수비 역할: press(압박) · block(패스길 차단) · zone(라인 유지) · mark(대인 마크)
// dy는 골대 중심선 기준. 배치는 무작위로 위아래 뒤집힌다.
const STAGES = [
  {
    id: 1, place: '춘천', title: '첫 번째 킥오프', theme: 'chuncheon', goals: 3,
    story: '호숫가 연습장에서 웅심이와 옹심이가 처음 호흡을 맞춰요.',
    lesson: '느린 수비수를 웅심이 쪽으로 끌어당긴 뒤, 옹심이에게 패스하고 다시 받아 슛!',
    comboStar: 8, timeRatio: 0.4, defMul: 0.85, crowd: 0.25, tutorial: true,
    layouts: [
      [{ r: 'press', x: 150, dy: -8 }, { r: 'zone', x: 320, dy: 18 }],
      [{ r: 'press', x: 165, dy: 26 }, { r: 'zone', x: 300, dy: -28 }],
      [{ r: 'zone', x: 230, dy: 0 }, { r: 'press', x: 330, dy: -22 }],
    ],
  },
  {
    id: 2, place: '강릉', title: '바닷바람 패스', theme: 'beach', goals: 3,
    story: '소나무 너머로 파도가 치는 해변 구장. 바닷바람이 공을 휘게 해요.',
    lesson: '화면 위 바람 예고를 보세요. 긴 패스·슛은 휘니 짧은 패스로 다가가요.',
    comboStar: 10, timeRatio: 0.3, defMul: 0.95, crowd: 0.35, wind: true,
    layouts: [
      [{ r: 'press', x: 160, dy: -18 }, { r: 'zone', x: 280, dy: 30 }, { r: 'zone', x: 360, dy: -28 }],
      [{ r: 'press', x: 175, dy: 20 }, { r: 'block', x: 255, dy: 0 }, { r: 'zone', x: 355, dy: 12 }],
      [{ r: 'zone', x: 205, dy: -40 }, { r: 'zone', x: 215, dy: 40 }, { r: 'press', x: 335, dy: 0 }],
    ],
  },
  {
    id: 3, place: '알펜시아', title: '미끄러운 승부', theme: 'snow', goals: 3,
    story: '풍력발전기가 도는 대관령 고원의 알펜시아. 반짝이는 얼음 위에서는 잘 멈추지 못해요.',
    lesson: '얼음 구간(하늘색)에서만 미끄러져요. 안전한 잔디 길과 빠른 얼음 길 중 골라요.',
    comboStar: 10, timeRatio: 0.3, defMul: 0.95, crowd: 0.35, ice: true,
    layouts: [
      [{ r: 'press', x: 165, dy: -10 }, { r: 'zone', x: 290, dy: 30 }, { r: 'zone', x: 365, dy: -26 }],
      [{ r: 'press', x: 150, dy: 26 }, { r: 'block', x: 250, dy: -12 }, { r: 'zone', x: 350, dy: 20 }],
      [{ r: 'zone', x: 220, dy: 30 }, { r: 'press', x: 290, dy: -30 }, { r: 'zone', x: 370, dy: 10 }],
    ],
    // 얼음이 생길 수 있는 대략의 구역. 실제 모양은 공격마다 무작위 구름·물웅덩이 (match.js buildIce)
    iceSets: [
      [{ x: 118, y: 60, w: 160, h: 62 }, { x: 276, y: 186, w: 136, h: 62 }],
      [{ x: 180, y: 94, w: 150, h: 122 }],
      [{ x: 112, y: 184, w: 180, h: 64 }, { x: 292, y: 60, w: 118, h: 66 }],
    ],
  },
  {
    id: 4, place: '춘천 송암', title: '주황빛 홈경기', theme: 'night', goals: 4,
    story: '춘천 송암의 밤, 주황빛 응원석이 가득 찼어요. 상대가 짝을 지어 협력 수비를 해요.',
    lesson: '한 명은 압박, 한 명은 패스 길을 막아요. 원투패스로 두 사람 사이에 틈을 만들어요.',
    comboStar: 12, timeRatio: 0.25, defMul: 1.0, crowd: 0.8,
    layouts: [
      [{ r: 'press', x: 160, dy: 0 }, { r: 'block', x: 230, dy: -20 }, { r: 'zone', x: 350, dy: 20 }],
      [{ r: 'press', x: 150, dy: -30 }, { r: 'block', x: 240, dy: 30 }, { r: 'mark', x: 300, dy: -20 }],
      [{ r: 'press', x: 170, dy: 20 }, { r: 'block', x: 220, dy: -10 }, { r: 'zone', x: 330, dy: -30 }, { r: 'zone', x: 385, dy: 30 }],
    ],
  },
  {
    // 결승 홈구장: 강릉 하이원아레나
    id: 5, place: '강릉 하이원아레나', title: '미라클 5:4', theme: 'arena', goals: 5,
    story: '가득 찬 하이원아레나, 0:4에서 시작하는 역전 도전! 2019년 6월 23일 포항전 5:4 역전승에서 영감을 받은 창작 스테이지예요.',
    lesson: '골을 넣을 때마다 수비 배치가 바뀌어요. 실패하면 시간이 5초 더 줄어요. 마지막 골키퍼는 가장 까다로워요.',
    comboStar: 14, timeRatio: 0.2, defMul: 1.0, crowd: 1.0, finale: true, extraTime: 30, oppScore: 4,
    // 득점 수에 따라 순서대로 사용
    layouts: [
      [{ r: 'press', x: 150, dy: -10 }, { r: 'zone', x: 260, dy: 30 }, { r: 'zone', x: 350, dy: -25 }],
      [{ r: 'press', x: 170, dy: 20 }, { r: 'block', x: 240, dy: -10 }, { r: 'zone', x: 350, dy: 20 }],
      [{ r: 'press', x: 150, dy: -20 }, { r: 'block', x: 230, dy: 20 }, { r: 'mark', x: 300, dy: 0 }, { r: 'zone', x: 380, dy: -20 }],
      [{ r: 'press', x: 160, dy: 10 }, { r: 'press', x: 255, dy: -30 }, { r: 'block', x: 300, dy: 20 }, { r: 'zone', x: 380, dy: 0 }],
      [{ r: 'press', x: 150, dy: 0 }, { r: 'block', x: 230, dy: -20 }, { r: 'mark', x: 300, dy: 20 }, { r: 'zone', x: 370, dy: -10 }],
    ],
  },
];

function stageTime(stage, diffKey) {
  return DIFFS[diffKey].time + (stage.extraTime || 0);
}
function stageTimeStar(stage, diffKey) {
  return Math.round(stageTime(stage, diffKey) * stage.timeRatio);
}
