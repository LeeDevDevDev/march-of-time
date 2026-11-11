import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import {
  DEFAULT_STANDALONE_PERK_NODES,
  getCombatTagBadgeClass,
  getCombatTagCounterLabel,
} from './core/compendium/compendium.model';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the March of Time app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the March of Time header', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('March of Time');
  });

  it('should map Defense Triangle combat tags to canonical rules and badge tokens', () => {
    expect(getCombatTagBadgeClass('Crushing')).toBe('badge-crushing');
    expect(getCombatTagCounterLabel('Crushing')).toBe('Cannot Parry');

    expect(getCombatTagBadgeClass('Sweeping')).toBe('badge-sweeping');
    expect(getCombatTagCounterLabel('Sweeping')).toBe('Cannot Dodge');

    expect(getCombatTagBadgeClass('Piercing')).toBe('badge-piercing');
    expect(getCombatTagCounterLabel('Piercing')).toBe('Cannot Block');

    const shieldBash = DEFAULT_STANDALONE_PERK_NODES.find(
      (node) => node.slug === 'shield-bash'
    );
    expect(shieldBash?.combat_tag).toBe('Crushing');
    expect(shieldBash?.rule_hooks.disallow_defense).toEqual(['Parry']);
  });
});
