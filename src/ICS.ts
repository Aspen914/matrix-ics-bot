import { MatrixClient } from "matrix-bot-sdk";
import { DateTime } from "luxon";
import ical from "ical.js";

const SUMMARY_PREFIX = "SUMMARY:";

/**
 * Extracts the first VEVENT block (inclusive of BEGIN/END markers) from a raw
 * iCalendar document, so the rest of the calendar can be ignored.
 */
function extractVEvent(text: string): string {
    const lines = text.replace(/\r/g, "").split("\n");

    const start = lines.findIndex((line) => line.trim().toUpperCase() === "BEGIN:VEVENT");
    if (start === -1) {
        throw new Error("No BEGIN:VEVENT found in calendar");
    }

    const endOffset = lines.slice(start).findIndex((line) => line.trim().toUpperCase() === "END:VEVENT");
    if (endOffset === -1) {
        throw new Error("No END:VEVENT found in calendar");
    }

    return lines.slice(start, start + endOffset + 1).join("\n") + "\n";
}

/**
 * Convert an ICAL.Time occurrence into a luxon DateTime.
 *
 * - UTC times become DateTimes in the UTC zone.
 * - Times with a TZID become DateTimes in that zone (ical.js resolves the zone
 *   from the feed's VTIMEZONE components or, failing that, from Intl data).
 * - Floating times become DateTimes in the bot's local timezone.
 */
function toLuxonDateTime(time: ical.Time): DateTime {
    const tzid = time.zone.tzid;
    const milliseconds = time.toJSDate().getTime();

    if (tzid === "UTC") {
        return DateTime.fromMillis(milliseconds, { zone: "utc" });
    }
    if (tzid && tzid !== "floating") {
        const candidate = DateTime.fromMillis(milliseconds, { zone: tzid });
        if (candidate.isValid) {
            return candidate;
        }
    }
    return DateTime.fromMillis(milliseconds);
}

export class ICS {
    private veventComponent?: ical.Component;
    private event?: ical.Event;
    private icsSubject = "";

    public constructor(
        private readonly mxcUriOrRaw: string,
        private readonly client: MatrixClient,
    ) {}

    public get subject(): string {
        return this.icsSubject;
    }

    public get nextEvent(): DateTime | null {
        return this.nextOccurrenceFrom(DateTime.now());
    }

    public get nextNextEvent(): DateTime | null {
        return this.nextOccurrenceFrom(DateTime.now().plus({ minutes: 1 }));
    }

    private nextOccurrenceFrom(from: DateTime): DateTime | null {
        if (!this.event) return null;

        // The iterator must be anchored at the event's real DTSTART: passing a
        // future start time to iterator() would re-anchor the recurrence rule
        // itself (for example, it shifts the weekday of a WEEKLY rule). We
        // therefore walk forward from DTSTART, skipping occurrences that have
        // already passed.
        const iterator = this.event.iterator();
        const fromMs = from.toMillis();

        let occurrence: ical.Time | null;
        do {
            occurrence = iterator.next();
        } while (occurrence && occurrence.toJSDate().getTime() < fromMs);

        return occurrence ? toLuxonDateTime(occurrence) : null;
    }

    public async parse(): Promise<void> {
        let text = this.mxcUriOrRaw;
        if (this.mxcUriOrRaw.startsWith("mxc://")) {
            const media = await this.client.downloadContent(this.mxcUriOrRaw);
            text = media.data.toString("utf-8");
        }

        const veventText = extractVEvent(text);

        // Parse the full document (not just the extracted VEVENT block) so that
        // VTIMEZONE components are available when resolving TZIDs. The document
        // may also be a bare VEVENT (that is what toString() persists), in which
        // case the parsed root component is the VEVENT itself. Only the first
        // VEVENT is used, matching the original behavior.
        const root = new ical.Component(ical.parse(text));
        const vevent = root.name === "vevent" ? root : root.getFirstSubcomponent("vevent");
        if (!vevent) {
            throw new Error("No VEVENT found in calendar");
        }

        this.veventComponent = vevent;
        this.event = new ical.Event(vevent);

        const subject = veventText.split("\n").find((line) => line.startsWith(SUMMARY_PREFIX));
        this.icsSubject = subject ? subject.substring(SUMMARY_PREFIX.length) : "";
    }

    public toString(): string {
        return this.veventComponent?.toString() ?? "";
    }
}
