# FAQ

Short answers, with a link to the long one.

### What does it cost?

Nothing. openGym is open source under the AGPL: no subscription, no paid tier, no ads. If you'd like
to support it anyway, there's [Buy Me a Coffee](https://buymeacoffee.com/duartesantos).

### Do I need my own server?

No, there are three ways to use it:

- **Try it:** the [online demo](https://opengym.ch/demo/) runs entirely in your
  browser with example data.
- **Phone only:** the Android app needs no server and no account; everything stays on the phone.
  See [MOBILE.md](MOBILE.md).
- **Your own instance:** `docker compose up` on any machine with Docker gives you sync between
  devices and profiles for friends and family. See [SELF_HOSTING.md](SELF_HOSTING.md).

### Is there an iPhone app?

Not in the App Store, and Apple doesn't allow installing apps from anywhere else. On an iPhone you can
self-host and add openGym to your home screen from Safari (it's a full PWA that works offline), or
build the native app onto your own phone with Xcode. Both are described in [MOBILE.md](MOBILE.md).
An App Store build is on the [roadmap](../ROADMAP.md).

### Why isn't it on the Play Store?

That's deliberate. The APK is signed, published with a `.sha256` next to every release, and the app
checks for updates itself. Get it from the
[latest release](https://github.com/DuarteSantos8/openGym/releases/latest).

### Where is my data?

On a self-hosted instance, in the `./data` folder next to `docker-compose.yml`: one JSON file per
profile plus the account list. Back up that folder and you've backed up everything. In the phone app
it's in the app's private storage. In guest mode it's only in that browser. You can export
everything as one file at any time under **Settings → Data & backup**.

### My home-screen web app still shows an older version.

A home-screen app can resume an already-open page instead of loading the website again.
While online, open **Settings → About & updates → Check for updates**. Once the update is ready,
finish editing and choose **Reload openGym**. The web app also checks when it returns to the
foreground; it never reloads an in-progress screen automatically. Reloading keeps saved workouts
and the current workout on the device.

On an older build without that control, save your edits and use the browser's Reload action
inside the pinned app, if available, or close it from Android's recent apps and reopen it.
Check that the pinned app opens the same address as the updated browser tab: a shortcut saved to
an individual deployment URL will not follow updates to your production address.
Do not clear site storage or uninstall as an update workaround: guest and unsynced workouts may
exist only there. Export a backup under **Settings → Data & backup** before any storage reset.

### Does the app send anything anywhere?

Your instance has no telemetry and phones home to nobody. The exercise pictures and animations ship
inside the web image, so not even those are downloaded. The AI coach, if an admin turns it on, sends
the training data it needs to the provider you configured; [AI_COACH.md](AI_COACH.md) lists exactly
what. Push notifications go through your browser's push service, as all web push does.

### Can I change the widgets on Home?

Under **Settings → Look & Home → On Home**, switch **Week & Today** off to hide the combined
week or rotation overview, Today's workout and **Choose a different workout**.
Switch **Recent workouts** on independently to show your
five latest saved workouts, newest first; tap one for its details or **History** for the full list.
An active workout still shows its Resume control (or Edit when editing a saved workout).
The combined Week & Today widget is on by default and recent workouts are off. These settings do not
delete workouts or change your training plan.

### Was openGym written with AI?

It's developed with [Claude Code](https://claude.com/claude-code), Anthropic's coding agent, and a
large share of the code, tests and docs is drafted that way. The maintainer decides what goes in,
reviews it, and tests every release on a staging instance and on real phones. The longer answer is in
the [README](../README.md#how-opengym-is-built).

### Does the app itself use AI?

Only if you turn it on. The default install calls no AI service. Two optional pieces exist: the
[AI coach](AI_COACH.md) (off until an admin enables it, runs with your own provider key, every
change needs your approval) and the [MCP server](../mcp/README.md), which lets an AI client on your
computer read your history. Neither is needed for anything else in the app.

### My passkey sign-in doesn't work.

Almost always one of two things:

1. You're opening it over plain `http://` on a LAN address. Passkeys only work over HTTPS (or on
   `localhost`). Use guest mode, turn on password sign-in, or put it behind HTTPS.
2. `RP_ID` and `ORIGIN` in `.env` don't match the address in your browser exactly.

[SELF_HOSTING.md](SELF_HOSTING.md#2-understand-the-passkey-requirement-important) explains both, and
its troubleshooting section covers the rarer cases.

### Can I use a password instead of a passkey?

Yes, if the instance allows it: set `PASSWORD_LOGIN=1`. It's off by default. See
[password sign-in](SELF_HOSTING.md#password-sign-in-optional).

### Can several people use one instance?

Yes. Everyone creates their own profile and sees only their own data. You can make signup
invite-only and give yourself an admin dashboard; see
[multiple users](SELF_HOSTING.md#4-multiple-users).

### How do I update?

`git pull && docker compose pull && docker compose up -d`. Your data is untouched. See
[updating](SELF_HOSTING.md#8-updating).

Then update the app on every device that syncs. A phone still on v1.3.9 or older keeps syncing,
and the server looks after what that phone doesn't know about, but it can't always tell what the
phone has seen. One case it gets wrong on purpose: if the old phone sets something back to exactly
what it was before, after another device changed it, the other device's change wins. Once every
device is updated, nobody has to guess.

### I'm moving from another app. Can I bring my history?

FitNotes, Strong and Hevy work out of the box, Apple Health for body weight, and any CSV with a date,
an exercise and something measured. See [DATA_IMPORTS.md](DATA_IMPORTS.md).

### Can a routine let me choose between different exercises at the gym?

Yes. Open an exercise in **Plan**, choose **Add alternative**, and configure the other exercise.
The routine keeps one position with interchangeable options, not a superset. Each option has
its own sets, reps, weight, progression and history; different equipment is fine.

Choose an exercise when you reach that position in each workout. You can change your choice
before logging, but cannot swap it after logging starts. To work across multiple options, use
**Add another exercise from this group**: it adds the other exercise with its own full planned
sets and leaves the original exercise and logged sets unchanged. These additions affect only
the current workout, not the routine. Reloading resumes your choices.

Plan muscle coverage uses the first option as its baseline, counting the position once.
Workout statistics use only exercises actually performed. If the position is in a superset,
its chosen exercise stays in that superset; an explicitly added option is placed after the
superset, not automatically added to its round.

Groups travel in backups, account sync and shared plans. Use an updated openGym on all devices
and when importing a shared plan: older versions do not understand alternatives and may show
only the first option or lose options when editing/re-exporting.

### Can I inspect an exercise before adding it?

Tap an exercise's row in **Add exercise**, whether you are editing a routine in Plan or adding
to your current workout. It opens the same exercise details as the **Exercises** tab, including
media, instructions, history and variants. **Add to routine** or **Add to this workout** adds it
immediately with the default settings, or your previous settings in a freestyle workout.
Choose **Edit details before adding** to set sets, reps and weight first. The **+** button on a
picker row also adds it immediately.

### Can I track different machines for the same exercise separately?

Yes. Open the exercise in the **Exercise Library**, choose **Create variant**, and give it a label
such as **Nautilus** or **Gym80**. The variant starts with the base exercise's equipment and muscles;
you can adjust these and add your own description, photo or video. Without its own media, it uses
the base exercise's artwork and instructions.

Variants are grouped with their base in the Library and exercise pickers, but each has its own
exercise ID, workout history, progression and records. Select the specific variant when adding
it to a routine or swapping an exercise. Previous sessions are not moved or combined.
Variant relationships survive sync, backups and shared plans. Deleting a custom base does not
delete its variants or their logged sets.

### Can I reuse the exercise images in my own project?

No. They are © Aliaksandr Makatserchyk, Gym visual, licensed for use in openGym only and not covered
by openGym's license. Anything outside openGym needs your own licence from
[gymvisual.com](https://gymvisual.com/). Details in [NOTICE.md](../NOTICE.md). The exercise text in
[catalogue/](../catalogue/README.md) is a different story: that's openGym's, and fixes are welcome.

### Where do I ask something that isn't here?

The [Discord](https://discord.gg/e62jY6fwVb) for a quick answer,
[Discussions](https://github.com/DuarteSantos8/openGym/discussions) if the next person should be
able to find it, [Issues](https://github.com/DuarteSantos8/openGym/issues) for a bug.
