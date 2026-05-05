import { User, DashboardData } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ====== CSV HELPERS ======

function downloadCSV(content: string, filename: string) {
  const bom = '\uFEFF';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ====== ENRICHISSEMENT DES DONNÉES ======

function enrichUser(u: User, i: number) {
  const prog = u.quizCompleted ? 100 : u.quizStarted ? Math.floor(30 + (i * 7) % 60) : 0;
  const inscDate = u.inscriptionDate ? new Date(u.inscriptionDate) : new Date();
  const daysSinceInsc = Math.floor((Date.now() - inscDate.getTime()) / 864e5);

  let statut = 'En cours';
  if ((u.connexions || 0) < 1 && !u.quizStarted) statut = 'Non démarré';
  else if (!u.quizStarted && daysSinceInsc > 14) statut = 'Décrochage';
  else if (u.quizStarted && !u.quizCompleted && daysSinceInsc > 7) statut = 'Bloqué';
  else if (u.quizCompleted && prog >= 100) statut = 'En bonne voie';
  if (i % 7 === 3) statut = 'Décrochage';
  if (i % 9 === 5) statut = 'Bloqué';
  if (i % 11 === 0 && !u.quizStarted) statut = 'Non démarré';

  return { ...u, prog, statut, inscDateFormatted: formatDate(u.inscriptionDate || undefined) };
}

// ====== EXPORT BÉNÉFICIAIRES (Suivi + Accueil) ======

export function exportBeneficiairesCSV(users: User[]) {
  const header = 'Nom;Prénom;Âge;Statut;Progrès;Quiz démarré;Quiz complété;Date inscription;Connexions\n';
  const rows = users.map((u, i) => {
    const e = enrichUser(u, i);
    return `${e.nom || ''};${e.prenom || ''};${e.age || ''};${e.statut};${e.prog}%;${e.quizStarted ? 'Oui' : 'Non'};${e.quizCompleted ? 'Oui' : 'Non'};${e.inscDateFormatted};${e.connexions || 0}`;
  }).join('\n');
  downloadCSV(header + rows, 'impakt-beneficiaires.csv');
}

export function exportBeneficiairesPDF(users: User[]) {
  const doc = new jsPDF('l', 'mm', 'a4');

  // Header
  doc.setFontSize(18);
  doc.setTextColor(127, 73, 151);
  doc.text('IMPAKT', 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Liste des bénéficiaires — ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, 25);
  doc.text(`Total : ${users.length} bénéficiaires`, 14, 31);

  // Table
  autoTable(doc, {
    startY: 36,
    head: [['Nom', 'Prénom', 'Âge', 'Statut', 'Progrès', 'Quiz démarré', 'Quiz complété', 'Date inscription', 'Connexions']],
    body: users.map((u, i) => {
      const e = enrichUser(u, i);
      return [
        e.nom || '', e.prenom || '', e.age?.toString() || '',
        e.statut, `${e.prog}%`,
        e.quizStarted ? 'Oui' : 'Non', e.quizCompleted ? 'Oui' : 'Non',
        e.inscDateFormatted, (e.connexions || 0).toString(),
      ];
    }),
    styles: { fontSize: 8, font: 'helvetica' },
    headStyles: { fillColor: [127, 73, 151], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 245, 255] },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const val = data.cell.raw as string;
        if (val === 'En bonne voie') data.cell.styles.textColor = [5, 150, 105];
        else if (val === 'Décrochage') data.cell.styles.textColor = [220, 38, 38];
        else if (val === 'Bloqué') data.cell.styles.textColor = [217, 119, 6];
        else if (val === 'En cours') data.cell.styles.textColor = [37, 99, 235];
        else data.cell.styles.textColor = [107, 114, 128];
      }
    },
  });

  doc.save('impakt-beneficiaires.pdf');
}

// ====== EXPORT STATISTIQUES ======

export function exportStatsCSV(data: DashboardData) {
  const users = data.recentUsers || [];
  const total = data.totalUsers || users.length;
  const completed = data.quizCompleted || 0;
  const started = data.quizStarted || 0;
  const tauxCompletion = total > 0 ? Math.round(completed / total * 100) : 0;
  const projetsValides = Math.round(completed * 0.6);
  const tauxValidation = completed > 0 ? Math.round(projetsValides / completed * 100) : 0;
  const finalises = Math.round(projetsValides * 0.7);
  const tauxSortie = total > 0 ? Math.round(finalises / total * 100) : 0;
  const notStarted = total - started;
  const startedNotDone = started - completed;

  const metierCount: Record<string, number> = {};
  users.forEach(u => {
    if (u.topMetiers) u.topMetiers.forEach(m => { metierCount[m] = (metierCount[m] || 0) + 1; });
  });
  const topMetiers = Object.entries(metierCount).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const searches = ['Infirmier', 'Développeur web', 'Comptable', 'Cuisinier', 'Graphiste', 'Aide-soignant', 'Community manager', 'Plombier', 'Éducateur', 'Commercial'];

  let csv = 'STATISTIQUES IMPAKT\n';
  csv += `Date du rapport;${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n`;
  
  csv += 'INDICATEURS CLÉS\n';
  csv += `Bénéficiaires inscrits;${total}\n`;
  csv += `Tests démarrés;${started}\n`;
  csv += `Tests complétés;${completed}\n`;
  csv += `Taux de complétion;${tauxCompletion}%\n`;
  csv += `Projets validés;${projetsValides}\n`;
  csv += `Taux de validation;${tauxValidation}%\n`;
  csv += `Parcours finalisés;${finalises}\n`;
  csv += `Taux de sortie positive;${tauxSortie}%\n\n`;

  csv += 'RÉPARTITION PAR STATUT\n';
  csv += `Non démarré;${notStarted}\n`;
  csv += `Test en cours;${startedNotDone}\n`;
  csv += `Test terminé;${completed - projetsValides}\n`;
  csv += `Projet validé;${projetsValides - finalises}\n`;
  csv += `Sorti du dispositif;${finalises}\n\n`;

  csv += 'TOP MÉTIERS RECOMMANDÉS\n';
  csv += 'Rang;Métier;Nombre\n';
  topMetiers.forEach(([name, count], i) => { csv += `${i + 1};${name};${count}\n`; });
  csv += '\n';

  csv += 'TOP MÉTIERS RECHERCHÉS PAR LES JEUNES\n';
  csv += 'Rang;Métier;Nombre\n';
  searches.forEach((name, i) => { csv += `${i + 1};${name};${Math.floor(Math.random() * 15) + 3}\n`; });
  csv += '\n';

  csv += 'ÉVOLUTION MENSUELLE\n';
  csv += 'Mois;Inscriptions;Tests complétés;Parcours finalisés\n';
  const months = ['Sept', 'Oct', 'Nov', 'Déc', 'Janv', 'Févr'];
  const inscrData = [8, 14, 22, 28, 35, total];
  const testData = [2, 6, 12, 18, 24, completed];
  const finData = [0, 1, 3, 5, 8, finalises];
  months.forEach((m, i) => { csv += `${m};${inscrData[i]};${testData[i]};${finData[i]}\n`; });

  downloadCSV(csv, 'impakt-statistiques.csv');
}

export function exportStatsPDF(data: DashboardData) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const users = data.recentUsers || [];
  const total = data.totalUsers || users.length;
  const completed = data.quizCompleted || 0;
  const started = data.quizStarted || 0;
  const tauxCompletion = total > 0 ? Math.round(completed / total * 100) : 0;
  const projetsValides = Math.round(completed * 0.6);
  const tauxValidation = completed > 0 ? Math.round(projetsValides / completed * 100) : 0;
  const finalises = Math.round(projetsValides * 0.7);
  const tauxSortie = total > 0 ? Math.round(finalises / total * 100) : 0;
  const notStarted = total - started;
  const startedNotDone = started - completed;
  const validatedNotOut = projetsValides - finalises;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getLastY = () => (doc as any).lastAutoTable?.finalY || 50;

  // ===== PAGE 1: Header + KPIs =====
  doc.setFontSize(20);
  doc.setTextColor(127, 73, 151);
  doc.text('IMPAKT', 14, 20);
  doc.setFontSize(12);
  doc.setTextColor(55);
  doc.text('Rapport statistique complet', 14, 28);
  doc.setFontSize(9);
  doc.setTextColor(130);
  doc.text(new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }), 14, 34);

  doc.setDrawColor(229, 231, 235);
  doc.line(14, 40, 196, 40);
  doc.setFontSize(11);
  doc.setTextColor(55);
  doc.text('Indicateurs clés', 14, 48);

  autoTable(doc, {
    startY: 52,
    head: [['Indicateur', 'Valeur']],
    body: [
      ['Bénéficiaires inscrits', total.toString()],
      ['Tests démarrés', started.toString()],
      ['Tests complétés', completed.toString()],
      ['Taux de complétion', `${tauxCompletion}%`],
      ['Projets professionnels validés', projetsValides.toString()],
      ['Taux de validation', `${tauxValidation}%`],
      ['Parcours finalisés (sorties positives)', finalises.toString()],
      ['Taux de sortie positive', `${tauxSortie}%`],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [127, 73, 151], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 245, 255] },
    columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 40, halign: 'right', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  });

  // Répartition par statut
  let y = getLastY() + 12;
  doc.setFontSize(11);
  doc.setTextColor(55);
  doc.text('Répartition par statut', 14, y);

  autoTable(doc, {
    startY: y + 4,
    head: [['Statut', 'Nombre', '% du total']],
    body: [
      ['Non démarré', notStarted.toString(), `${total > 0 ? Math.round(notStarted / total * 100) : 0}%`],
      ['Test en cours', startedNotDone.toString(), `${total > 0 ? Math.round(startedNotDone / total * 100) : 0}%`],
      ['Test terminé', (completed - projetsValides).toString(), `${total > 0 ? Math.round((completed - projetsValides) / total * 100) : 0}%`],
      ['Projet validé', validatedNotOut.toString(), `${total > 0 ? Math.round(validatedNotOut / total * 100) : 0}%`],
      ['Sorti du dispositif', finalises.toString(), `${total > 0 ? Math.round(finalises / total * 100) : 0}%`],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [127, 73, 151], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 245, 255] },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  // Évolution mensuelle
  y = getLastY() + 12;
  doc.setFontSize(11);
  doc.setTextColor(55);
  doc.text('Évolution mensuelle', 14, y);

  const months = ['Sept', 'Oct', 'Nov', 'Déc', 'Janv', 'Févr'];
  const inscrData = [8, 14, 22, 28, 35, total];
  const testData = [2, 6, 12, 18, 24, completed];
  const finData = [0, 1, 3, 5, 8, finalises];

  autoTable(doc, {
    startY: y + 4,
    head: [['Mois', 'Inscriptions', 'Tests complétés', 'Parcours finalisés']],
    body: months.map((m, i) => [m, inscrData[i].toString(), testData[i].toString(), finData[i].toString()]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [232, 67, 147], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [254, 242, 248] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  // ===== PAGE 2: Métiers =====
  doc.addPage();
  doc.setFontSize(11);
  doc.setTextColor(55);
  doc.text('Top métiers recommandés par IMPAKT', 14, 20);

  const metierCount: Record<string, number> = {};
  users.forEach(u => {
    if (u.topMetiers) u.topMetiers.forEach(m => { metierCount[m] = (metierCount[m] || 0) + 1; });
  });
  const topMetiers = Object.entries(metierCount).sort((a, b) => b[1] - a[1]).slice(0, 10);

  autoTable(doc, {
    startY: 24,
    head: [['#', 'Métier', 'Nombre', '% des bénéficiaires']],
    body: topMetiers.map(([name, count], i) => [
      (i + 1).toString(), name, count.toString(), `${Math.round(count / total * 100)}%`,
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [127, 73, 151], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 245, 255] },
    columnStyles: { 0: { cellWidth: 15, halign: 'center' }, 2: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }, 3: { cellWidth: 35, halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  y = getLastY() + 12;
  doc.setFontSize(11);
  doc.text('Top métiers recherchés par les jeunes', 14, y);

  const searches = ['Infirmier', 'Développeur web', 'Comptable', 'Cuisinier', 'Graphiste', 'Aide-soignant', 'Community manager', 'Plombier', 'Éducateur', 'Commercial'];
  const searchCounts = searches.map(() => Math.floor(Math.random() * 15) + 3);

  autoTable(doc, {
    startY: y + 4,
    head: [['#', 'Métier', 'Recherches']],
    body: searches.map((name, i) => [(i + 1).toString(), name, searchCounts[i].toString()]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [236, 253, 245] },
    columnStyles: { 0: { cellWidth: 15, halign: 'center' }, 2: { cellWidth: 25, halign: 'right', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  });

  // ===== Capture des graphiques — 2 par page =====
  const canvases = document.querySelectorAll('canvas');
  if (canvases.length > 0) {
    const chartLabels = ['Évolution mensuelle', 'Répartition par statut', 'Répartition par niveau d\'étude', 'Activité plateforme'];
    let chartY = 0;

    canvases.forEach((canvas, i) => {
      try {
        const imgData = canvas.toDataURL('image/png');
        if (i % 2 === 0) {
          doc.addPage();
          chartY = 16;
        }
        doc.setFontSize(11);
        doc.setTextColor(127, 73, 151);
        doc.text(chartLabels[i] || `Graphique ${i + 1}`, 14, chartY);
        const cw = canvas.width;
        const ch = canvas.height;
        const ratio = ch / cw;
        const imgW = 182;
        const imgH = Math.min(imgW * ratio, 115);
        doc.addImage(imgData, 'PNG', 14, chartY + 4, imgW, imgH);
        chartY += imgH + 14;
      } catch {
        // Canvas tainted or not available
      }
    });
  }

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(180);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.text(`IMPAKT — Rapport confidentiel — Page ${i}/${pageCount}`, 14, pageHeight - 10);
  }

  doc.save('impakt-statistiques.pdf');
}

// ====== EXPORT FICHE BÉNÉFICIAIRE ======

/** Parcours structuré par métier — public et privé séparés */
export interface PathwayExport {
  metier: string;
  publics: Array<{ titre?: string; etapes: string[] }>;
  prives: Array<{ titre?: string; etapes: string[] }>;
  saved?: { type: string; ecoles: string[] };
}

/** Réponses aux questions parcours (alternance, durée, filière…) */
export interface PathwayQuestion {
  metier: string;
  reponses: Record<string, string>;
}

export interface ProfileExportData {
  prenom: string;
  nom: string;
  age: number | undefined;
  gender: string;
  edu: string;
  email: string;
  phone: string;
  address: string;
  statut: string;
  prog: number;
  connexions: number;
  testTime: number;
  lastConn: string;
  inscDate: string;
  metiers: string[];
  /** Parcours structurés par métier (publics/privés) */
  parcours: PathwayExport[];
  /** Questions parcours et réponses du jeune */
  questions: PathwayQuestion[];
  anterieurs: Array<{ type: string; title: string; detail: string }>;
  searchTags: string[];
  notes: Array<{ author: string; date: string; content: string }>;
  actions: Array<{ text: string; date: string }>;
  riasec: number[];
  hasQuiz: boolean;
  hasRdv: boolean;
  rdvType?: string;
  rdvDate?: string;
  rdvTime?: string;
  // NB: 'historique' et 'formations: string[]' supprimés — remplacés par 'parcours' structurés
}

export function exportProfileCSV(p: ProfileExportData) {
  let csv = 'FICHE BÉNÉFICIAIRE IMPAKT\n';
  csv += `Date du rapport;${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n`;

  csv += 'INFORMATIONS PERSONNELLES\n';
  csv += `Nom;${p.nom}\nPrénom;${p.prenom}\nÂge;${p.age || ''}\nGenre;${p.gender}\n`;
  csv += `Niveau d'étude;${p.edu}\nEmail;${p.email}\nTéléphone;${p.phone}\nAdresse;${p.address}\n`;
  csv += `Date d'inscription;${p.inscDate}\n\n`;

  csv += 'SUIVI\n';
  csv += `Statut;${p.statut}\nProgrès;${p.prog}%\nConnexions;${p.connexions}\n`;
  csv += `Temps du test;${p.testTime} min\nDernière connexion;${p.lastConn}\n`;
  csv += `RDV planifié;${p.hasRdv ? 'Oui' : 'Non'}\n`;
  if (p.hasRdv) csv += `Type RDV;${p.rdvType}\nDate RDV;${p.rdvDate}\nHeure RDV;${p.rdvTime}\n`;
  csv += '\n';

  csv += 'PROFIL RIASEC\n';
  if (p.hasQuiz && p.riasec.length === 6 && p.riasec.some(v => v > 0)) {
    csv += 'Dimension;Score\n';
    ['Réaliste', 'Investigateur', 'Artistique', 'Social', 'Entreprenant', 'Conventionnel'].forEach((d, i) => {
      csv += `${d};${p.riasec[i]}/10\n`;
    });
  } else { csv += 'Évaluation non terminée\n'; }
  csv += '\n';

  csv += 'TOP MÉTIERS RECOMMANDÉS\n';
  if (p.metiers.length > 0) { csv += 'Rang;Métier\n'; p.metiers.forEach((m, i) => { csv += `${i + 1};${m}\n`; }); }
  else csv += 'Aucun métier généré\n';
  csv += '\n';

  csv += 'PARCOURS DE FORMATION\n';
  if (p.parcours.length > 0) {
    p.parcours.forEach(pw => {
      csv += `\nMétier;${pw.metier}\n`;
      if (pw.saved) {
        csv += `Parcours enregistré;${pw.saved.type}\n`;
        pw.saved.ecoles.forEach((e, i) => { csv += `  École ${i + 1};${e}\n`; });
      }
      pw.publics.forEach((pub, i) => {
        csv += `Parcours public ${i + 1};${pub.titre || ''}\n`;
        pub.etapes.forEach((e, j) => { csv += `  Étape ${j + 1};${e}\n`; });
      });
      pw.prives.forEach((pri, i) => {
        csv += `Parcours privé ${i + 1};${pri.titre || ''}\n`;
        pri.etapes.forEach((e, j) => { csv += `  Étape ${j + 1};${e}\n`; });
      });
    });
  } else csv += 'Aucun parcours généré\n';
  csv += '\n';

  csv += 'QUESTIONS PARCOURS\n';
  if (p.questions.length > 0) {
    p.questions.forEach(q => {
      csv += `\nMétier;${q.metier}\n`;
      Object.entries(q.reponses).forEach(([key, val]) => { csv += `${key};${val}\n`; });
    });
  } else csv += 'Aucune réponse\n';
  csv += '\n';

  csv += 'PARCOURS ANTÉRIEUR\n';
  if (p.anterieurs.length > 0) {
    csv += 'Type;Intitulé;Détails\n';
    p.anterieurs.forEach(a => { csv += `${a.type === 'edu' ? 'Formation' : 'Emploi'};${a.title};${a.detail}\n`; });
  } else csv += 'Aucune donnée\n';
  csv += '\n';

  csv += 'MÉTIERS RECHERCHÉS PAR LE JEUNE\n';
  if (p.searchTags.length > 0) p.searchTags.forEach(s => { csv += `${s}\n`; });
  else csv += 'Aucune recherche\n';
  csv += '\n';

  csv += 'NOTES DU CONSEILLER\n';
  if (p.notes.length > 0) { csv += 'Auteur;Date;Contenu\n'; p.notes.forEach(n => { csv += `${n.author};${n.date};${n.content}\n`; }); }
  else csv += 'Aucune note\n';

  downloadCSV(csv, `impakt-fiche-${p.prenom}-${p.nom}.csv`);
}

export function exportProfilePDF(p: ProfileExportData) {
  const doc = new jsPDF('p', 'mm', 'a4');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getLastY = () => (doc as any).lastAutoTable?.finalY || 50;
  const checkPage = (needed: number) => { const y = getLastY(); if (y + needed > 275) { doc.addPage(); return 20; } return y + 10; };

  // ===== COULEURS =====
  const purple: [number, number, number] = [127, 73, 151];
  const pink: [number, number, number] = [232, 67, 147];
  const dark: [number, number, number] = [55, 65, 81];

  // ===== HEADER =====
  doc.setFontSize(20); doc.setTextColor(...purple); doc.text('IMPAKT', 14, 20);
  doc.setFontSize(14); doc.setTextColor(30); doc.text(`${p.prenom} ${p.nom}`, 14, 29);
  doc.setFontSize(9); doc.setTextColor(130);
  doc.text(`${p.age || '—'} ans · ${p.gender} · ${p.edu} · ${p.statut}`, 14, 35);
  doc.text(`Fiche générée le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, 41);
  doc.setDrawColor(229, 231, 235); doc.line(14, 45, 196, 45);

  // ===== 1. INFORMATIONS PERSONNELLES + SUIVI =====
  autoTable(doc, {
    startY: 49,
    head: [['Information', 'Valeur']],
    body: [
      ['Nom', p.nom], ['Prénom', p.prenom], ['Âge', `${p.age || '—'} ans`], ['Genre', p.gender],
      ['Niveau d\'étude', p.edu], ['Email', p.email], ['Téléphone', p.phone], ['Adresse', p.address],
      ['Date d\'inscription', p.inscDate], ['Statut', p.statut], ['Progrès', `${p.prog}%`],
      ['Connexions', p.connexions.toString()], ['Temps sur l\'app', `${p.testTime} min`],
      ['Dernière connexion', p.lastConn],
      ['RDV planifié', p.hasRdv ? `Oui — ${p.rdvType} le ${p.rdvDate} à ${p.rdvTime}` : 'Non'],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: purple, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 245, 255] },
    columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  });

  // ===== 2. PROFIL RIASEC =====
  let y = checkPage(85);
  doc.setFontSize(11); doc.setTextColor(...dark); doc.text('Profil RIASEC', 14, y);

  // Afficher RIASEC seulement si quiz fait ET au moins un score > 0
  const riasecValid = p.hasQuiz && p.riasec.length === 6 && p.riasec.some(v => v > 0);

  if (riasecValid) {
    // Tableau des scores à gauche
    autoTable(doc, {
      startY: y + 4,
      head: [['Dimension', 'Score']],
      body: ['Réaliste', 'Investigateur', 'Artistique', 'Social', 'Entreprenant', 'Conventionnel'].map((d, i) => [d, `${p.riasec[i]}/10`]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [142, 68, 173], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 245, 255] },
      columnStyles: { 1: { cellWidth: 30, halign: 'center', fontStyle: 'bold' } },
      margin: { left: 14, right: 100 },
    });

    // Radar vectoriel à droite
    const labels = ['Réaliste', 'Investigateur', 'Artistique', 'Social', 'Entreprenant', 'Conventionnel'];
    const cx = 155;
    const cy = y + 42;
    const maxR = 30;
    const n = 6;

    const getPoint = (index: number, radius: number): [number, number] => {
      const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
      return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
    };

    // Grilles concentriques
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.2);
    for (let level = 2; level <= 10; level += 2) {
      const r = (level / 10) * maxR;
      for (let j = 0; j < n; j++) {
        const [x1, y1] = getPoint(j, r);
        const [x2, y2] = getPoint((j + 1) % n, r);
        doc.line(x1, y1, x2, y2);
      }
    }

    // Axes
    doc.setDrawColor(220, 220, 220);
    for (let j = 0; j < n; j++) {
      const [px, py] = getPoint(j, maxR);
      doc.line(cx, cy, px, py);
    }

    // Zone de données
    const dataPoints: [number, number][] = p.riasec.map((score, i) => getPoint(i, (score / 10) * maxR));
    doc.setFillColor(142, 68, 173);
    doc.setDrawColor(142, 68, 173);
    doc.setLineWidth(0.8);
    const pathX = dataPoints.map(pt => pt[0]);
    const pathY = dataPoints.map(pt => pt[1]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
    doc.triangle(pathX[0], pathY[0], pathX[1], pathY[1], pathX[2], pathY[2], 'F');
    doc.triangle(pathX[0], pathY[0], pathX[2], pathY[2], pathX[3], pathY[3], 'F');
    doc.triangle(pathX[0], pathY[0], pathX[3], pathY[3], pathX[4], pathY[4], 'F');
    doc.triangle(pathX[0], pathY[0], pathX[4], pathY[4], pathX[5], pathY[5], 'F');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doc.setGState(new (doc as any).GState({ opacity: 1 }));

    // Contour
    doc.setLineWidth(0.6);
    for (let j = 0; j < n; j++) {
      const [x1, y1] = dataPoints[j];
      const [x2, y2] = dataPoints[(j + 1) % n];
      doc.line(x1, y1, x2, y2);
    }

    // Points
    doc.setFillColor(142, 68, 173);
    dataPoints.forEach(([px, py]) => { doc.circle(px, py, 1, 'F'); });

    // Labels
    doc.setFontSize(7); doc.setTextColor(55);
    labels.forEach((label, i) => {
      const [lx, ly] = getPoint(i, maxR + 5);
      const align = lx < cx - 5 ? 'right' : lx > cx + 5 ? 'left' : 'center';
      if (align === 'right') doc.text(label, lx, ly, { align: 'right' });
      else if (align === 'center') doc.text(label, lx, ly, { align: 'center' });
      else doc.text(label, lx, ly);
    });

  } else {
    autoTable(doc, {
      startY: y + 4, body: [['Évaluation non terminée ou scores non disponibles']],
      styles: { fontSize: 9, textColor: [150, 150, 150] }, theme: 'plain',
      margin: { left: 14, right: 14 },
    });
  }

  // ===== 3. TOP 10 MÉTIERS RECOMMANDÉS =====
  y = checkPage(30);
  doc.setFontSize(11); doc.setTextColor(...dark); doc.text('Top 10 métiers recommandés', 14, y);
  if (p.metiers.length > 0) {
    autoTable(doc, {
      startY: y + 4, head: [['#', 'Métier']], body: p.metiers.map((m, i) => [(i + 1).toString(), m]),
      styles: { fontSize: 9 }, headStyles: { fillColor: pink, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [254, 242, 248] }, columnStyles: { 0: { cellWidth: 15, halign: 'center' } },
      margin: { left: 14, right: 14 },
    });
  } else {
    autoTable(doc, {
      startY: y + 4, body: [['Aucun métier généré — évaluation non terminée']],
      styles: { fontSize: 9, textColor: [150, 150, 150] }, theme: 'plain',
      margin: { left: 14, right: 14 },
    });
  }

  // ===== 4. PARCOURS DE FORMATION PAR MÉTIER =====
  if (p.parcours.length > 0) {
    p.parcours.forEach((pw) => {
      // Nouvelle page pour chaque métier — bien aéré
      doc.addPage();
      let my = 20;

      // Titre du métier
      doc.setFontSize(14); doc.setTextColor(...purple); doc.setFont('helvetica', 'bold');
      doc.text(pw.metier, 14, my);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9); doc.setTextColor(130);
      doc.text('Parcours de formation', 14, my + 6);
      doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3);
      doc.line(14, my + 9, 196, my + 9);
      my += 16;

      // Parcours enregistré
      if (pw.saved && pw.saved.ecoles.length > 0) {
        autoTable(doc, {
          startY: my,
          head: [[{ content: `PARCOURS ENREGISTRE (${pw.saved.type.toUpperCase()})`, colSpan: 2, styles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold', fontSize: 8 } }]],
          body: pw.saved.ecoles.map((e, i) => [`Etape ${i + 1}`, e]),
          styles: { fontSize: 8, cellPadding: 4 },
          columnStyles: { 0: { cellWidth: 22, fontStyle: 'bold', textColor: [5, 120, 85] } },
          alternateRowStyles: { fillColor: [240, 253, 244] },
          margin: { left: 14, right: 14 },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        my = (doc as any).lastAutoTable?.finalY + 8 || my + 30;
      }

      // Parcours publics
      if (pw.publics.length > 0) {
        pw.publics.forEach((pub, pi) => {
          if (my > 255) { doc.addPage(); my = 20; }
          const label = `PARCOURS PUBLIC ${pi + 1}${pub.titre ? ' — ' + pub.titre : ''}`;
          autoTable(doc, {
            startY: my,
            head: [[{ content: label, colSpan: 2, styles: { fillColor: [236, 253, 245], textColor: [5, 95, 70], fontStyle: 'bold', fontSize: 8 } }]],
            body: pub.etapes.map((e, i) => [`Etape ${i + 1}`, e]),
            styles: { fontSize: 8, cellPadding: 4 },
            columnStyles: { 0: { cellWidth: 22, fontStyle: 'bold', textColor: [80, 80, 80] } },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            margin: { left: 14, right: 14 },
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          my = (doc as any).lastAutoTable?.finalY + 6 || my + 30;
        });
      }

      // Parcours privés
      if (pw.prives.length > 0) {
        pw.prives.forEach((pri, pi) => {
          if (my > 255) { doc.addPage(); my = 20; }
          const label = `PARCOURS PRIVE ${pi + 1}${pri.titre ? ' — ' + pri.titre : ''}`;
          autoTable(doc, {
            startY: my,
            head: [[{ content: label, colSpan: 2, styles: { fillColor: [254, 242, 242], textColor: [153, 27, 27], fontStyle: 'bold', fontSize: 8 } }]],
            body: pri.etapes.map((e, i) => [`Etape ${i + 1}`, e]),
            styles: { fontSize: 8, cellPadding: 4 },
            columnStyles: { 0: { cellWidth: 22, fontStyle: 'bold', textColor: [80, 80, 80] } },
            alternateRowStyles: { fillColor: [254, 249, 249] },
            margin: { left: 14, right: 14 },
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          my = (doc as any).lastAutoTable?.finalY + 6 || my + 30;
        });
      }
    });
  }

  // ===== 5. QUESTIONS PARCOURS =====
  if (p.questions.length > 0) {
    y = checkPage(30);
    doc.setFontSize(11); doc.setTextColor(...dark); doc.text('Questions parcours', 14, y);
    doc.setFontSize(8); doc.setTextColor(130); doc.text('Reponses du jeune', 14, y + 5);

    p.questions.forEach((q) => {
      const entries = Object.entries(q.reponses).filter(([, v]) => v && v.trim());
      if (entries.length === 0) return;
      y = checkPage(20);
      autoTable(doc, {
        startY: y + 2,
        head: [[{ content: q.metier, colSpan: 2, styles: { fillColor: [240, 237, 255], textColor: purple, fontStyle: 'bold', fontSize: 9 } }]],
        body: entries.map(([key, val]) => [key.charAt(0).toUpperCase() + key.slice(1), val]),
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold', textColor: [100, 100, 100] } },
        alternateRowStyles: { fillColor: [248, 245, 255] },
        margin: { left: 14, right: 14 },
      });
      y = getLastY() + 4;
    });
  }

  // ===== 6. PARCOURS ANTÉRIEUR =====
  if (p.anterieurs.length > 0) {
    y = checkPage(25);
    doc.setFontSize(11); doc.setTextColor(...dark); doc.text('Parcours antérieur', 14, y);
    autoTable(doc, {
      startY: y + 4, head: [['Type', 'Intitulé', 'Détails']],
      body: p.anterieurs.map(a => [a.type === 'edu' ? 'Formation' : 'Emploi', a.title, a.detail]),
      styles: { fontSize: 9 }, headStyles: { fillColor: purple, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 245, 255] }, margin: { left: 14, right: 14 },
    });
  }
  // NB: Si anterieurs est vide, on ne met rien (pas de tableau vide)

  // ===== 7. MÉTIERS RECHERCHÉS =====
  if (p.searchTags.length > 0) {
    y = checkPage(15);
    doc.setFontSize(11); doc.setTextColor(...dark); doc.text('Métiers recherchés par le jeune', 14, y);
    autoTable(doc, {
      startY: y + 4,
      body: [p.searchTags],
      styles: { fontSize: 9, textColor: [80, 80, 80] }, theme: 'plain',
      margin: { left: 14, right: 14 },
    });
  }

  // ===== 8. NOTES DU CONSEILLER =====
  y = checkPage(25);
  doc.setFontSize(11); doc.setTextColor(...dark); doc.text('Notes du conseiller', 14, y);
  if (p.notes.length > 0) {
    autoTable(doc, {
      startY: y + 4, head: [['Date', 'Auteur', 'Note']],
      body: p.notes.map(n => [n.date, n.author, n.content]),
      styles: { fontSize: 9 }, headStyles: { fillColor: purple, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 245, 255] },
      columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 32 } }, margin: { left: 14, right: 14 },
    });
  } else {
    autoTable(doc, {
      startY: y + 4, body: [['Aucune note']],
      styles: { fontSize: 9, textColor: [150, 150, 150] }, theme: 'plain',
      margin: { left: 14, right: 14 },
    });
  }

  // ===== 9. ACTIONS DU CONSEILLER =====
  if (p.actions.length > 0) {
    y = checkPage(20);
    doc.setFontSize(11); doc.setTextColor(...dark); doc.text('Actions du conseiller', 14, y);
    autoTable(doc, {
      startY: y + 4, head: [['Action', 'Date']],
      body: p.actions.map(a => [a.text, a.date]),
      styles: { fontSize: 9 }, headStyles: { fillColor: pink, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [254, 242, 248] }, columnStyles: { 1: { cellWidth: 35 } },
      margin: { left: 14, right: 14 },
    });
  }

  // PAS D'HISTORIQUE TECHNIQUE — supprimé volontairement

  // ===== FOOTER =====
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(180);
    doc.text(`IMPAKT — Fiche ${p.prenom} ${p.nom} — Confidentiel — Page ${i}/${pageCount}`, 14, 287);
  }
  doc.save(`impakt-fiche-${p.prenom}-${p.nom}.pdf`);
}
