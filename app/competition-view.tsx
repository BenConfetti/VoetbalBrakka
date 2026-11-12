'use client';

import { useState } from 'react';
import styles from './competition-view.module.css';

type Team = { club: string; team: string; logo?: string };
type Opponent = Team & { id: string };
type SavedMatch = { id: string; opponentId: string; date: string; location: 'home' | 'away'; matchType?: string };

const teams = [
  'AWC O11-3JM',
  'Brakkenstein O11-1',
  'Blauw Wit O11-2',
  'Orion O11-3',
  'De Treffers O11-5',
  'Woezik O11-2JM',
  'Aquila O11-1JM',
  "Juliana '31 O11-2",
] as const;

// Gespeeld, gewonnen, gelijk, verloren, punten, voor, tegen, punten in mindering.
const standings = [
  [3, 2, 1, 0, 7, 9, 6, 0],
  [2, 2, 0, 0, 6, 15, 4, 0],
  [2, 2, 0, 0, 6, 6, 3, 0],
  [3, 2, 0, 1, 6, 19, 8, 0],
  [3, 1, 0, 2, 3, 11, 19, 0],
  [3, 1, 0, 2, 3, 12, 21, 0],
  [3, 0, 1, 2, 1, 7, 11, 0],
  [3, 0, 0, 3, 0, 6, 13, 0],
] as const;

const clubCodes = ['BBKX38Z', 'BBKV43N', 'BBKS313', 'BBKT01T', 'BBKW37T', 'BBKS67I', 'BBKS11V', 'BBKR65B'];
const brakkenstein = 1;

const matchDays = [
  { date: '2026-11-07', matches: [[1, 10, 2, 4], [2, 3, 1, 7], [6, 2, 2, 0], [5, 1, 10, 3]] },
  { date: '2026-10-31', matches: [[7, 2, 5, 1], [2, 3, 2, 6], [3, 3, 4, 0], [4, 8, 6, 5]] },
  { date: '2026-10-28', matches: [[0, 3, 1, 4]] },
  { date: '2026-10-24', matches: [[6, 3, 6, 3], [5, 5, 3, 7]] },
];

const tabs = ['Uitslagen', 'Stand', 'Historie'] as const;
const columns = [
  ['G', 'Gespeeld'], ['W', 'Gewonnen'], ['GL', 'Gelijk'], ['V', 'Verloren'],
  ['P', 'Punten'], ['+', 'Doelpunten voor'], ['−', 'Doelpunten tegen'], ['PM', 'Punten in mindering'],
] as const;

function teamKey(name: string) {
  return name.toLowerCase().replace(/\bjo(?=\d)/g, 'o').replace(/[\s.'’\-]/g, '');
}

export default function CompetitionView({ opponents, ownTeam, savedMatches, onOpenMatch }: {
  opponents: Opponent[];
  ownTeam: Team;
  savedMatches: SavedMatch[];
  onOpenMatch: (id: string) => void;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>('Uitslagen');
  const ownKey = teamKey(`${ownTeam.club} ${ownTeam.team}`);
  const logos = new Map<string, string>();
  for (const { club, team, logo } of [ownTeam, ...opponents]) {
    if (logo) logos.set(teamKey(`${club} ${team}`), logo);
  }

  function renderTeam(index: number) {
    const name = teams[index];
    const key = teamKey(name);
    const logo = logos.get(key) || 'https://logoapi.voetbal.nl/logo.php?clubcode=' + clubCodes[index];
    return <span className={styles.team}>
      {logo && <img src={logo} alt="" width={24} height={24} />}
      <span className={key === ownKey ? styles.ownTeam : undefined}>{name}</span>
    </span>;
  }

  return <>
    <div className="page-head">
      <div>
        <span className="eyebrow">Seizoen 2026/2027</span>
        <h1>Competitie</h1>
        <p>0269 Onder 11 (2e fase) · 2e klasse · District Oost · Poule 844243</p>
      </div>
    </div>
    <nav className="quarter-tabs" aria-label="Competitie">
      {tabs.map(label => <button key={label} type="button" aria-pressed={label === tab}
        className={label === tab ? 'active' : undefined} onClick={() => setTab(label)}>{label}</button>)}
    </nav>
    {tab === 'Uitslagen' && matchDays.map(({ date, matches }) =>
      <section className={`dashboard-card ${styles.card}`} key={date}>
        <header><h2>{new Intl.DateTimeFormat('nl-NL', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(date))}</h2></header>
        <ul className={styles.results}>
          {matches.map(([home, goalsHome, goalsAway, away]) => {
            const isHome = home === brakkenstein;
            const ownResult = isHome || away === brakkenstein;
            const opponentName = teams[isHome ? away : home];
            const linkedMatches = ownResult ? savedMatches.filter(match =>
              match.date === date && match.location === (isHome ? 'home' : 'away') &&
              (match.matchType ?? 'competition') === 'competition' &&
              opponents.some(opponent => opponent.id === match.opponentId &&
                teamKey(opponent.club + ' ' + opponent.team) === teamKey(opponentName))
            ) : [];
            const linkedMatch = linkedMatches.length === 1 ? linkedMatches[0] : undefined;
            const result = <>
              {renderTeam(home)}<strong className={styles.score}>{goalsHome}–{goalsAway}</strong>{renderTeam(away)}
            </>;

            return <li key={home + '-' + away}>
              {linkedMatch
                ? <button type="button" className={styles.resultLink} onClick={() => onOpenMatch(linkedMatch.id)}
                    aria-label={'Open wedstrijd: ' + teams[home] + ' tegen ' + teams[away]}>{result}</button>
                : <div className={styles.resultRow}>{result}</div>}
            </li>;
          })}
        </ul>
      </section>
    )}
    {tab === 'Stand' && <section className={`dashboard-card ${styles.card}`}>
      <header><h2>Stand algemeen</h2></header>
      <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Stand algemeen">
        <table className={styles.standings}>
          <thead><tr><th scope="col">#</th><th scope="col">Team</th>
            {columns.map(([label, title]) => <th scope="col" key={label} title={title}>{label}</th>)}
          </tr></thead>
          <tbody>{standings.map((row, index) => <tr key={teams[index]}>
            <td>{index + 1}</td><th scope="row">{renderTeam(index)}</th>
            {row.map((value, column) => <td key={columns[column][0]}>{column === 4 ? <strong>{value}</strong> : value}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </section>}
    {tab === 'Historie' && <section className={`dashboard-card ${styles.card}`}>
      <header><h2>Historie</h2></header>
      <div className="empty">Er is nog geen competitiehistorie toegevoegd.</div>
    </section>}
  </>;
}
