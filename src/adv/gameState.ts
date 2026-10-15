/** All state is optional. Unknown account data must never become a positive branch. */
export interface GameStateProvider {
  isCollection?: boolean;
  isRevival?: boolean;
  questPhaseClear?(questId: number, phase?: number): boolean | undefined;
  svtEquipHaving?(id: number): boolean | undefined;
  routeSelected?(questId: number, routeId: number): boolean | undefined;
  routeSelectCount?(quests: number[], routes: number[], count: number, op: string): boolean | undefined;
  grandSvtCount?: number;
  questMessageOverwrite?(label: string): string | undefined;
}
export function compareCount(scriptValue: number, actual: number, op: string): boolean {
  return op === "BELOW" ? scriptValue <= actual : op === "ABOVE" ? scriptValue >= actual : op === "EQUAL" && scriptValue === actual;
}
export function routeCount(provider: GameStateProvider | undefined, quests: number[], routes: number[], count: number, op: string): boolean | undefined {
  if (provider?.routeSelectCount) return provider.routeSelectCount(quests, routes, count, op);
  if (!provider?.routeSelected) return undefined;
  const selected = new Set<number>(); let unknown = false;
  for (const quest of new Set(quests)) for (const route of new Set(routes)) {
    const value = provider.routeSelected(quest, route);
    if (value === undefined) unknown = true;
    if (value) selected.add(route);
  }
  return unknown ? undefined : compareCount(count, selected.size, op);
}
