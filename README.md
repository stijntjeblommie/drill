# Morning Drill

iPhone quant mental-math drill with trick-of-the-day, exercise timers, and Shortcuts unlock.

**Live URL (use this in your alarm automation):**  
https://stijntjeblommie.github.io/drill/?force=1

## The force (no Guided Access)

A webpage **cannot** lock your phone. Triple-click Guided Access will not stick if you will skip it. The stick is a **backup alarm** that only turns off when the drill says you finished.

### 1. Alarms (Clock app)
- Main alarm e.g. **6:00**
- Backup alarms e.g. **6:10**, **6:15**, **6:20** (loud, no snooze if you can)

### 2. Alarm → open the drill
Shortcuts → Automation → **Alarm** → your 6:00 alarm → **Is Stopped** → **Run Immediately**  
Action: **Open URLs** → `https://stijntjeblommie.github.io/drill/?force=1`

`?force=1` auto-starts the drill, keeps strict mode on, and disables skipping exercises.

### 3. Shortcut: `Morning Done` (name must match exactly)
Actions:
1. **Toggle Alarm** → turn **off** the 6:10 alarm  
2. **Toggle Alarm** → turn **off** the 6:15 alarm  
3. **Toggle Alarm** → turn **off** the 6:20 alarm  

Do **not** turn those backups off by hand in Clock. The end-of-drill button is what runs this shortcut.

### 4. Shortcut: `Drill Done` (optional but useful)
1. **Current Date**
2. **Save File** → `drill-done.txt` (Ask Where off, Overwrite on)

### 5. Re-arm every night
Automation → **Time of Day** (e.g. 22:00) → toggle the three backup alarms **on** again.

### Morning loop
Alarm rings → you stop it → Safari/drill opens and starts → hit ≥15 correct + exercises → **Silence backup alarms** → backups stay quiet. Close the page early and the backups still ring.

## Local

```bash
python3 -m http.server 8080 --directory .
```
