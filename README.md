# timepheus

A Slack bot that converts natural language dates and times to users' local time zone.

## Usage

Join the [Hack Club Slack](https://hackclub.com/slack) and take a look at [#timepheus-bot](https://hackclub.slack.com/archives/C09FHSGH9QD)! Send a message containing some natural language dates and/or times, and @timepheus will automatically reply with a message containing these datetimes that magically displays in each user's local time :)

You can also invite @timepheus to your own channels, private or public, and it will also send those datetimes for you!

## How does it work?

There are two magical things happening here:

The first is the detection of natural language datetimes. I used the incredible [chrono-node](https://github.com/wanasit/chrono) library for this, and it works wonders! Except for one thing: it doesn't handle time zones very well (it can only accept basic rules which you need to code yourself). So I had to:

1. Find the UTC offset of the sending user's time zone with `Intl.DateTimeFormat` API
2. Run the library to detect dates
3. Find the UTC offset at that specific date (to account for DST)
4. Run the library on each individual date again :(

But I think I got it to detect all dates, including DST, correctly! If you find any error, please let me know.

The second magic is sending a single message that all users see in their local time. I used a Slack API for that: in the Blocks Kit, there is [a date Rich Text Element](https://docs.slack.dev/reference/block-kit/blocks/rich-text-block/#date-element-type), which supports showing a Unix timestamp in a formatted string to the user. (I initially tried having each user click a button or add a reaction for the bot to send them an ephemeral message, but I decided the UX is bad.) Sadly, this API **does not work** on mobile, although it is clearly documented - there's unfortunately nothing I can do :sob:

Regarding other technical details: the project is written in [Bun](https://bun.com), the fast all-in-one TS/JS runtime and package manager where (you heard it) TS and JSX files are first-class citizens just like JS! I will advertise Bun on every project until I convert more people so USE BUN :))))))

Also, I didn't use a Slack SDK because I want to write my own request verification logic with HMAC, as well as try calling the API methods myself! In the future I'll probably use an SDK to make my life easier.

Also also, the project is deployed on [Hack Club Nest](https://hackclub.app)!

## AI Disclaimer

AI was almost not used at all in the project. I even turned Copilot's autocompletions off for most of the development because I want to go back to the nostalgic days of working only with your IDE and the official docs. That's when we made real software :(
