import { describe, expect, it } from 'vitest';
import { cleanName, destinationOf, looksLikeAddress } from './names.ts';

describe('cleanName', () => {
  it('da un indirizzo tiene il luogo tra parentesi', () => {
    expect(cleanName('Via Roma (Cepina)')).toBe('Cepina');
    expect(cleanName('Piazza Quattro Novembre (Isolaccia)')).toBe('Isolaccia');
    expect(cleanName('SP27 (La Prese)')).toBe('La Prese');
    expect(cleanName('Chiesa di San Giacomo (Ravoledo)')).toBe('Ravoledo');
  });
  it('lascia stare le parentesi che non seguono un indirizzo', () => {
    expect(cleanName('Rifugio Monte alle Scale (Cancano)')).toBe('Rifugio Monte alle Scale (Cancano)');
  });
  it('scioglie le abbreviazioni di rifugio e bivacco', () => {
    expect(cleanName('Rif. Antonio ed Elia Longoni')).toBe('Rifugio Antonio ed Elia Longoni');
    expect(cleanName('Biv. Corti')).toBe('Bivacco Corti');
  });
  it('sistema gli spazi', () => {
    expect(cleanName('  Alpe   Motta ')).toBe('Alpe Motta');
  });
  it('toglie il numero del sentiero davanti al nome', () => {
    expect(cleanName('250 - Fusino')).toBe('Fusino');
    expect(cleanName('201 - Rifugio Schiazzera')).toBe('Rifugio Schiazzera');
  });
  it('corregge le maiuscole battute due volte', () => {
    expect(cleanName('DIga di Cancano')).toBe('Diga di Cancano');
    expect(cleanName('PIzzo Alto')).toBe('Pizzo Alto');
  });
  it('non tocca le sigle vere', () => {
    expect(cleanName('Rifugio CAI Mambretti')).toBe('Rifugio CAI Mambretti');
  });
  it('sopravvive a una parentesi rimasta aperta nei dati OSM', () => {
    expect(looksLikeAddress(cleanName('Via San Rocco (San Rocco('))).toBe(true);
  });
});

describe('looksLikeAddress', () => {
  it('riconosce gli indirizzi rimasti tali', () => {
    expect(looksLikeAddress('Strada Statale N.38 dello Stelvio')).toBe(true);
    expect(looksLikeAddress('Chiareggio')).toBe(false);
  });
});

describe('destinationOf', () => {
  it('riconosce il tipo di meta dal nome', () => {
    expect(destinationOf('Rifugio Longoni')).toBe('hut');
    expect(destinationOf('Bivacco Scermenone')).toBe('bivouac');
    expect(destinationOf('Laghi Torena')).toBe('lake');
    expect(destinationOf('Bocchetta di Trela')).toBe('pass');
    expect(destinationOf('Monte Storile')).toBe('peak');
    expect(destinationOf('Alpe Motta')).toBe('alp');
    expect(destinationOf('Chiareggio')).toBe('other');
  });
  it('guarda le parole intere: "Lagorai" non è un lago', () => {
    expect(destinationOf('Cima Lagorai')).toBe('peak');
  });
});
