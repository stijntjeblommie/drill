# Morning Drill

iPhone quant mental-math drill with trick-of-the-day, exercise timers, and Shortcuts unlock.

**Live URL (use this in every automation below):**
https://stijntjeblommie.github.io/drill/?force=1

`?force=1` auto-starts the drill, keeps strict mode on (≥15 correct), blocks skipping exercises,
and **resumes** an unfinished drill instead of resetting it. Once you've finished today, it shows
"Done for today" instead of making you redo it.

## Why the URL alone doesn't work

A webpage can't lock your phone. If the alarm opens the link, you can swipe it away or let the
banner time out, and nothing happens. Two things fix that:

1. **Backup alarms** keep ringing until the drill turns them off.
2. **An app gate**: opening Instagram, WhatsApp, Clock and so on before you've finished sends you
   back to the drill. You can't use your phone until you've done it.

Both rely on one shortcut, `Morning Done`. It writes today's date to `drill-done.txt` and turns
the backups off. The drill's **Silence backup alarms** button is what runs it.

## iPhone setup (once, about 10 minutes)

### 1. Alarms (Clock app)
- Main alarm: **6:00**
- Backups: **6:05, 6:10, 6:15, 6:20, 6:25** (loud, snooze off)

### 2. Shortcut `Morning Done` (exact name)
Shortcuts → **+** → name it `Morning Done`:
1. **Format Date**: Date = *Current Date*, Date Format = *Custom*, Format String = `yyyy-MM-dd`
2. **Save File**: input = *Formatted Date*, **Ask Where to Save off**, folder = *Shortcuts*,
   Subpath = `drill-done.txt`, **Overwrite If File Exists on**
3. **Toggle Alarm**: Turn **Off** 6:05 (repeat this action for each backup alarm)

### 3. Automation: every alarm opens the drill
Automation → **+** → **Alarm** → **Is Stopped** → **Any** → **Run Immediately** (Notify off)
- **Open URLs** → `https://stijntjeblommie.github.io/drill/?force=1`

### 4. Automation: the app gate (this is what stops you skipping it)
Automation → **+** → **App** → choose the apps you open in bed (Instagram, TikTok, YouTube,
WhatsApp, Snapchat, Reddit, X…) **plus Clock** → **Is Opened** → **Run Immediately** (Notify off):
1. **Get File from Folder**: folder *Shortcuts*, path `drill-done.txt`, **Error If Not Found off**
2. **Text**: insert the *File* variable from step 1
3. **Format Date**: *Current Date*, *Custom*, `yyyy-MM-dd`
4. **If** *Text* **is not** *Formatted Date*
   - **Open URLs** → `https://stijntjeblommie.github.io/drill/?force=1`
5. **End If**

Do **not** add Safari or Shortcuts to the gate: Safari is where the drill runs, and Shortcuts has
to open to run `Morning Done`.

Clock is in the gate so you can't open it and switch the backups off by hand.

### 5. Re-arm every night
Automation → **+** → **Time of Day** → 22:00, Daily → **Run Immediately**
- **Toggle Alarm**: Turn **On** each backup alarm

### 6. Test it tonight
1. Open Instagram: it should bounce you to the drill. (Approve any permission prompt with
   **Always Allow**.)
2. Run `Morning Done` from the Shortcuts app and approve its prompts. The backups should switch
   off, and Instagram should now open normally.
3. Run the 22:00 automation (▶ in its editor) to switch the backups back on.

`drill-done.txt` holds a date, so the gate re-arms itself at midnight with nothing to reset.

## The morning loop

Alarm → stop it → drill opens and starts → ≥15 correct + exercises → **Silence backup alarms**
→ Safari asks "Open in Shortcuts?" → **Open**. Backups go quiet and your apps unlock.

Closing Safari doesn't help. The next backup rings 5 minutes later and reopens the drill, and every
gated app you open sends you back to it. Your progress is kept.

The deliberate escape hatch is turning automations off in the Shortcuts app. That takes a
conscious decision, which is the point.

## Local

```bash
python3 -m http.server 8080 --directory .
```
