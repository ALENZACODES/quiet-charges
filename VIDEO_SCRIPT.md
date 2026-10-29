# Quiet Charges demo video script (about 2:20)

Target length 2:15 to 2:45. The rules page asks for 2 to 5 minutes and the overview says 1 to 3, so this range meets both. A captioned silent recording that follows these beats is in docs/demo-captioned.mp4 (2:15); read the lines below over it, or record your own screen while you say them.

| Time | On screen | Say |
|---|---|---|
| 0:00 | The start page | "Quick question. What did your subscriptions cost you this year? Most people can't say, because prices go up quietly and free trials turn into charges." |
| 0:10 | Same | "This is Quiet Charges. It reads your bank statement and finds all of it." |
| 0:15 | Point at the Network locked box | "It runs only in your browser. A security policy in the page blocks it from contacting any other server, so your statement never leaves your device." |
| 0:25 | Click Try a year of sample data | "This is a made up year of bank activity for someone in Toronto. 488 charges." |
| 0:30 | The four numbers | "Twelve subscriptions. $320 a month, $3,839 a year. And five of them raised their price." |
| 0:40 | First alert | "Audible started as a 99 cent trial, then switched to full price. That's the classic trap." |
| 0:47 | Second alert | "Spotify is billed twice: once directly, once through PayPal. That's a second account someone forgot, $156 a year." |
| 0:55 | Third alert | "Every price rise is checked against Statistics Canada's inflation numbers for the same months. Rogers went up 11.8% while prices overall went up 2.8%. Across everything, that's $181 a year more than inflation explains." |
| 1:10 | Scroll the next 30 days, then the table | "Here's what's coming out in the next 30 days, and every recurring charge with its flags." |
| 1:17 | Tick Audible, Spotify through PayPal and Crave | "I'll tick the three I don't want. That keeps $599 a year." |
| 1:25 | Open the Audible cancel kit | "Each one has a cancel kit: the official help page, the steps, and a message ready to send. Because this one started as a trial, the message asks for a refund too." |
| 1:38 | Open the Rogers kit | "Phone and internet bills are different. You don't cancel, you ask for a better price, so it gives you a script with your own numbers in it." |
| 1:48 | Open the paste box, paste the sample, read it | "No CSV? Copy the lines out of a PDF statement and paste them. OFX and QFX downloads work too, and several files are merged." |
| 1:58 | Point at the calendar button | "Then add reminders to your calendar, three days before each charge, with the cancel link inside." |
| 2:03 | Show src/engine.js briefly, then the tests passing | "How it works: it finds the rhythm in the gaps between charges, peels off trial charges, ignores exchange rate wobble, and compares each rise with inflation. 36 tests and a browser check keep it honest, including a thousand random purchases that must never look like a subscription." |
| 2:18 | Back to the top | "Quiet Charges. Find what you forgot and keep your money. I'm John Khan from Toronto, Ontario. Thanks for watching." |

Before recording, load the sample once and confirm the numbers on screen match the ones above ($320, $3,839, five raised, $156, $181, $599).
