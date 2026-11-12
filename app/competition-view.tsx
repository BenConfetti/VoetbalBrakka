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

type ArchivedCompetition = {
  id: string;
  year: string;
  period: number;
  archivedAt: string;
  teams: readonly string[];
  clubCodes: readonly string[];
  matchDays: typeof matchDays;
  standings: readonly (readonly number[])[];
};

const competitionHistory: readonly ArchivedCompetition[] = [{
  id: '2026-2027-1',
  year: '2026/2027',
  period: 1,
  archivedAt: '2026-10-03',
  teams: ['De Treffers O11-3', 'Trekvogels O11-1', 'Union O11-1JM', 'DVSG O11-1JM', 'Brakkenstein O11-1', 'Orion O11-3'],
  clubCodes: ['BBKW37T', 'BBKS91L', 'BBKR03L', 'BBKS80R', 'BBKV43N', 'BBKT01T'],
  matchDays: [
    { date: '2026-10-03', matches: [[1, 7, 2, 4], [0, 8, 4, 3], [2, 14, 1, 5]] },
    { date: '2026-09-26', matches: [[5, 0, 18, 0], [3, 4, 6, 1], [4, 1, 2, 2]] },
    { date: '2026-09-19', matches: [[1, 9, 5, 5], [0, 14, 2, 2], [4, 6, 1, 3]] },
    { date: '2026-09-12', matches: [[0, 8, 1, 1], [2, 5, 3, 3], [5, 6, 4, 4]] },
    { date: '2026-09-05', matches: [[1, 4, 4, 2], [3, 5, 0, 5], [4, 1, 19, 0]] },
  ],
  standings: [
    [5, 5, 0, 0, 15, 67, 8, 0],
    [5, 3, 1, 1, 10, 27, 23, 0],
    [5, 3, 1, 1, 10, 27, 23, 0],
    [5, 1, 0, 4, 3, 17, 25, 0],
    [5, 1, 0, 4, 3, 14, 35, 0],
    [5, 1, 0, 4, 3, 12, 50, 0],
  ],
}];
const archivedCompetitions = [...competitionHistory].sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));

const tabs = ['Uitslagen', 'Stand', 'Historie'] as const;
const columns = [
  ['G', 'Gespeeld'], ['W', 'Gewonnen'], ['GL', 'Gelijk'], ['V', 'Verloren'],
  ['P', 'Punten'], ['+', 'Doelpunten voor'], ['−', 'Doelpunten tegen'], ['PM', 'Punten in mindering'],
] as const;

function teamKey(name: string) {
  return name.toLowerCase().replace(/\bjo(?=\d)/g, 'o').replace(/[\s.'’\-]/g, '');
}

type HeadToHead = { id: string; date: string; home: boolean; goalsFor: number; goalsAgainst: number };

export function OpponentForm({ opponent, matchDate, ownName, history }: {
  opponent?: Team;
  matchDate: string;
  ownName: string;
  history: HeadToHead[];
}) {
  const index = opponent ? teams.findIndex(team => teamKey(team) === teamKey(`${opponent.club} ${opponent.team}`)) : -1;
  const from = new Date(matchDate);
  from.setUTCDate(from.getUTCDate() - 35);
  const recent = matchDays.flatMap(({ date, matches }) =>
    date < matchDate && new Date(date) >= from
      ? matches.filter(([home, , , away]) => home === index || away === index).map(match => ({ date, match }))
      : []
  );
  const dateFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const historyDateFormat = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeZone: 'UTC' });
  const opponentName = opponent ? [opponent.club, opponent.team].filter(Boolean).join(' ') : '';
  const historicalResults = [...history];
  for (const entry of archivedCompetitions) {
    const ownIndex = entry.teams.indexOf(teams[brakkenstein]);
    const opponentIndex = entry.teams.findIndex(team => teamKey(team) === teamKey(opponentName));
    if (ownIndex < 0 || opponentIndex < 0) continue;
    for (const { date, matches } of entry.matchDays) {
      if (date >= matchDate) continue;
      for (const [home, goalsHome, goalsAway, away] of matches) {
        const ownHome = home === ownIndex && away === opponentIndex;
        const ownAway = away === ownIndex && home === opponentIndex;
        if ((!ownHome && !ownAway) || historicalResults.some(result => result.date === date && result.home === ownHome)) continue;
        historicalResults.push({
          id: `${entry.id}-${date}-${home}-${away}`, date, home: ownHome,
          goalsFor: ownHome ? goalsHome : goalsAway, goalsAgainst: ownHome ? goalsAway : goalsHome,
        });
      }
    }
  }
  historicalResults.sort((a, b) => b.date.localeCompare(a.date));

  return <section className={`panel ${styles.card}`}>
    <div className="panel-head"><div><h2>Vorm van de tegenstander</h2></div></div>
    <h3>Onderlinge resultaten</h3>
    {historicalResults.length ? <ul className={`${styles.formResults} ${styles.historyResults}`}>
      {historicalResults.map(({ id, date, home, goalsFor, goalsAgainst }) => <li key={id}>
        <time dateTime={date}>{historyDateFormat.format(new Date(date))}</time>
        <span>{home ? ownName : opponentName} – {home ? opponentName : ownName}</span>
        <strong>{home ? goalsFor : goalsAgainst}–{home ? goalsAgainst : goalsFor}</strong>
      </li>)}
    </ul> : <div className="empty">Geen eerdere onderlinge resultaten bekend.</div>}
    <h3>Recente competitie-uitslagen</h3>
    <p>Vijf weken vóór deze wedstrijd</p>
    {recent.length ? <ul className={styles.formResults}>
      {recent.map(({ date, match: [home, goalsHome, goalsAway, away] }) => {
        const difference = (goalsHome - goalsAway) * (home === index ? 1 : -1);
        const outcome = difference > 0 ? 'Gewonnen' : difference < 0 ? 'Verloren' : 'Gelijkgespeeld';
        return <li key={`${date}-${home}-${away}`}>
          <span className={`${styles.formIcon} ${difference > 0 ? styles.win : difference < 0 ? styles.loss : ''}`}
            role="img" aria-label={outcome} title={outcome}>{difference > 0 ? '✓' : difference < 0 ? '×' : '='}</span>
          <time dateTime={date}>{dateFormat.format(new Date(date))}</time>
          <span>{teams[home]} – {teams[away]}</span>
          <strong>{goalsHome}–{goalsAway}</strong>
        </li>;
      })}
    </ul> : <div className="empty">Geen recente competitie-uitslagen beschikbaar.</div>}
  </section>;
}

export default function CompetitionView({ opponents, ownTeam, savedMatches, onOpenMatch }: {
  opponents: Opponent[];
  ownTeam: Team;
  savedMatches: SavedMatch[];
  onOpenMatch: (id: string) => void;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>('Uitslagen');
  const [archiveId, setArchiveId] = useState(archivedCompetitions[0]?.id ?? '');
  const [archiveTab, setArchiveTab] = useState<'Uitslagen' | 'Stand'>('Uitslagen');
  const archived = tab === 'Historie' ? archivedCompetitions.find(entry => entry.id === archiveId) : undefined;
  const displayedTab = tab === 'Historie' ? archived && archiveTab : tab;
  const displayedTeams = archived?.teams ?? teams;
  const displayedDays = archived?.matchDays ?? matchDays;
  const displayedStandings = archived?.standings ?? standings;
  const ownKey = teamKey(`${ownTeam.club} ${ownTeam.team}`);
  const logos = new Map<string, string>();
  for (const { club, team, logo } of [ownTeam, ...opponents]) {
    if (logo) logos.set(teamKey(`${club} ${team}`), logo);
  }

  function renderTeam(index: number) {
    const name = displayedTeams[index];
    const key = teamKey(name);
    const clubCode = (archived?.clubCodes ?? clubCodes)[index];
    const logo = logos.get(key) || (clubCode && 'https://logoapi.voetbal.nl/logo.php?clubcode=' + clubCode);
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
    {tab === 'Historie' && <section className={`dashboard-card ${styles.card}`}>
      <label>Competitie uit het archief
        <select value={archiveId} disabled={!archivedCompetitions.length} onChange={event => setArchiveId(event.target.value)}>
          {!archivedCompetitions.length && <option value="">Geen gearchiveerde competities</option>}
          {archivedCompetitions.map(entry =>
            <option key={entry.id} value={entry.id}>{entry.year} - {entry.period}</option>
          )}
        </select>
      </label>
      <nav className="quarter-tabs" aria-label="Historische competitie">
        {(['Uitslagen', 'Stand'] as const).map(label => <button key={label} type="button"
          disabled={!archived} aria-pressed={label === archiveTab} className={label === archiveTab ? 'active' : undefined}
          onClick={() => setArchiveTab(label)}>{label}</button>)}
      </nav>
    </section>}
    {displayedTab === 'Uitslagen' && displayedDays.map(({ date, matches }) =>
      <section className={`dashboard-card ${styles.card}`} key={date}>
        <header><h2>{new Intl.DateTimeFormat('nl-NL', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(date))}</h2></header>
        <ul className={styles.results}>
          {matches.map(([home, goalsHome, goalsAway, away]) => {
            const ownIndex = archived ? displayedTeams.findIndex(team => teamKey(team) === ownKey) : brakkenstein;
            const isHome = home === ownIndex;
            const ownResult = isHome || away === ownIndex;
            const opponentName = displayedTeams[isHome ? away : home];
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
                    aria-label={'Open wedstrijd: ' + displayedTeams[home] + ' tegen ' + displayedTeams[away]}>{result}</button>
                : <div className={styles.resultRow}>{result}</div>}
            </li>;
          })}
        </ul>
      </section>
    )}
    {displayedTab === 'Stand' && <section className={`dashboard-card ${styles.card}`}>
      <header><h2>Stand algemeen</h2></header>
      <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Stand algemeen">
        <table className={styles.standings}>
          <thead><tr><th scope="col">#</th><th scope="col">Team</th>
            {columns.map(([label, title]) => <th scope="col" key={label} title={title}>{label}</th>)}
          </tr></thead>
          <tbody>{displayedStandings.map((row, index) => <tr key={displayedTeams[index]}>
            <td>{index + 1}</td><th scope="row">{renderTeam(index)}</th>
            {row.map((value, column) => <td key={columns[column][0]}>{column === 4 ? <strong>{value}</strong> : value}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </section>}
  </>;
}
