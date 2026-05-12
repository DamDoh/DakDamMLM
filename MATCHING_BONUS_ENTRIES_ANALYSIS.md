# Matching Bonus Entries Analysis for ADM006 (Admin Add, President)

## Tree Structure

```
                    ADM006 (Admin Add, President)
                   /                              \
        ADM009 (Kea Kea, Silver)          ADM010 (Kea1 Kea2, Gold)
        G1 Left                            G1 Right
        /        \                          /        \
ADM011 (Silver)  ADM012 (Gold)    ADM013 (Gold)  ADM014 (Silver)
G2 Left          G2 Left          G2 Right       G2 Right
/    \            /    \            /    \          /    \
...   ...        ...   ...        ...   ...        ...   ...
G3 Left          G3 Left          G3 Right       G3 Right
```

## President Rank Rates
- **G1**: 60%
- **G2**: 10%
- **G3**: 10%

## Matching Bonus Entry Structure

### G1 (Generation 1) - Separated by Leg
- **G1 Left**: 1 entry (combines all Daily Match from ADM009)
- **G1 Right**: 1 entry (combines all Daily Match from ADM010)
- **Total G1 Entries**: **2 entries**

### G2 (Generation 2) - Individual Entries per Downline
- **G2 Left-Left**: 1 entry (ADM011 - left child of G1 Left)
- **G2 Left-Right**: 1 entry (ADM012 - right child of G1 Left)
- **G2 Right-Left**: 1 entry (ADM013 - left child of G1 Right)
- **G2 Right-Right**: 1 entry (ADM014 - right child of G1 Right)
- **Total G2 Entries**: **4 entries** (one per G2 downline)

### G3 (Generation 3) - Individual Entries per Downline (Labeled with G1-G2-G3 Position)
- **G3 Left-Left-Left**: ADM015 (fds fds, Silver) - left child of ADM011 (G2 Left-Left)
- **G3 Left-Left-Right**: ADM016 (rew rere, Gold) - right child of ADM011 (G2 Left-Left)
- **G3 Left-Right-Left**: ADM017 (uytr ytre, Gold) - left child of ADM012 (G2 Left-Right)
- **G3 Left-Right-Right**: ADM018 (uytre uytre, Diamond) - right child of ADM012 (G2 Left-Right)
- **G3 Right-Left-Left**: ADM019 (gfds gfds, Diamond) - left child of ADM013 (G2 Right-Left)
- **G3 Right-Left-Right**: ADM020 (gfgfd gfds, Silver) - right child of ADM013 (G2 Right-Left)
- **G3 Right-Right-Left**: ADM021 (ytr rere, Silver) - left child of ADM014 (G2 Right-Right)
- **G3 Right-Right-Right**: ADM022 (trew rew, Gold) - right child of ADM014 (G2 Right-Right)

- **Total G3 Entries**: **8 entries** (one per G3 downline that earns Daily Match)

## Total Matching Bonus Entries for ADM006

**Maximum Possible Entries**: 
- G1: 2 entries (Left + Right)
- G2: 4 entries (Left-Left, Left-Right, Right-Left, Right-Right)
- G3: 8 entries (one per G3 downline)
- **Total: 14 entries**

**Actual Entries** (depends on which downlines earn Daily Match):
- If all downlines earn Daily Match: **14 entries**
- If only some downlines earn Daily Match: **2-14 entries** (minimum 2 if only G1 downlines earn, maximum 14 if all downlines earn)

## Example Entry Names

1. `Matching Bonus (G1 Left): $X × 60% = $Y`
2. `Matching Bonus (G1 Right): $X × 60% = $Y`
3. `Matching Bonus (G2 Left-Left): $X × 10% = $Y (from ADM011)`
4. `Matching Bonus (G2 Left-Right): $X × 10% = $Y (from ADM012)`
5. `Matching Bonus (G2 Right-Left): $X × 10% = $Y (from ADM013)`
6. `Matching Bonus (G2 Right-Right): $X × 10% = $Y (from ADM014)`
7. `Matching Bonus (G3 Left-Left-Left): $X × 10% = $Y (from ADM015)`
8. `Matching Bonus (G3 Left-Left-Right): $X × 10% = $Y (from ADM016)`
9. `Matching Bonus (G3 Left-Right-Left): $X × 10% = $Y (from ADM017)`
10. `Matching Bonus (G3 Left-Right-Right): $X × 10% = $Y (from ADM018)`
11. `Matching Bonus (G3 Right-Left-Left): $X × 10% = $Y (from ADM019)`
12. `Matching Bonus (G3 Right-Left-Right): $X × 10% = $Y (from ADM020)`
13. `Matching Bonus (G3 Right-Right-Left): $X × 10% = $Y (from ADM021)`
14. `Matching Bonus (G3 Right-Right-Right): $X × 10% = $Y (from ADM022)`

## Key Points

1. **G1** is grouped by leg (left/right), so multiple downlines on the same leg are combined into one entry
2. **G2** creates individual entries for each downline, labeled with G1 leg and downline position (e.g., "G2 Left-Left", "G2 Left-Right")
3. **G3** creates individual entries for each downline, labeled with G1 leg, G2 position, and G3 position (e.g., "G3 Left-Left-Left", "G3 Left-Left-Right")
4. Entries are only created when downlines actually earn Daily Match commissions
5. **G2 entries** show both the G1 leg (Left/Right) and the downline's position relative to G1 (Left/Right), resulting in labels like:
   - G2 Left-Left: ADM011 (left child of G1 Left)
   - G2 Left-Right: ADM012 (right child of G1 Left)
   - G2 Right-Left: ADM013 (left child of G1 Right)
   - G2 Right-Right: ADM014 (right child of G1 Right)
6. **G3 entries** show the G1 leg, G2 position (same as G1 leg), and G3 position (downline's position relative to G2 parent), resulting in labels like:
   - G3 Left-Left-Left: ADM015 (left child of ADM011 which is G2 Left-Left)
   - G3 Left-Left-Right: ADM016 (right child of ADM011 which is G2 Left-Left)
   - G3 Right-Left-Left: ADM019 (left child of ADM013 which is G2 Right-Left)
   - G3 Right-Right-Right: ADM022 (right child of ADM014 which is G2 Right-Right)
