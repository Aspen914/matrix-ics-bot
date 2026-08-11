import { MatrixClient } from "matrix-bot-sdk";
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import sanitizeHtml from "sanitize-html";
import { ICS } from "./ICS";

export const REMINDER_INDEX_EVENT = "io.t2bot.ics_reminder.vevents.index";
export const REMINDER_EVENT_PREFIX = "io.t2bot.ics_reminder.vevents.vevent";

interface ReminderContent {
    vevent: string;
    summaryText: string;
    summaryHtml: string;
}

export class Reminder {
    private deleted = false;

    private constructor(
        private readonly client: MatrixClient,
        public readonly roomId: string,
        public readonly uid: string,
        public summaryText: string,
        public summaryHtml: string,
        public readonly ics: ICS,
    ) {}

    public get isDeleted(): boolean {
        return this.deleted;
    }

    public async tryTrigger(): Promise<void> {
        if (this.deleted) return;

        const next = this.ics.nextEvent;
        if (!next) return;

        // Fire when the occurrence is happening right now (within a second).
        const now = DateTime.now();
        if (Math.abs(now.diff(next).toMillis()) < 1000) {
            await this.client.sendMessage(this.roomId, {
                msgtype: "m.text",
                format: "org.matrix.custom.html",
                formatted_body: this.summaryHtml,
                body: this.summaryText,
                "io.t2bot.ics_reminder.message_kind": "trigger",
                "io.t2bot.ics_reminder.uid": this.uid,
                "io.t2bot.ics_reminder.vevent": this.ics.toString(),
                "io.t2bot.ics_reminder.next": this.ics.nextNextEvent
                    ? Math.floor(this.ics.nextNextEvent.toMillis() / 1000)
                    : null,
            });
        }
    }

    public async update(): Promise<void> {
        if (this.deleted) return;
        const content: ReminderContent = {
            vevent: this.ics.toString(),
            summaryText: this.summaryText,
            summaryHtml: this.summaryHtml,
        };
        await this.client.setRoomAccountData(`${REMINDER_EVENT_PREFIX}.${this.uid}`, this.roomId, content);
    }

    public async delete(): Promise<void> {
        if (this.deleted) return;
        const index = await this.client.getSafeRoomAccountData<Record<string, unknown>>(
            REMINDER_INDEX_EVENT,
            this.roomId,
            {},
        );
        delete index[this.uid];
        await this.client.setRoomAccountData(REMINDER_INDEX_EVENT, this.roomId, index);
        this.deleted = true;
    }

    public static async create(ics: ICS, roomId: string, client: MatrixClient): Promise<Reminder> {
        const uid = Buffer.from(`${roomId}|${randomUUID()}`, "utf8").toString("base64").replace(/[+/=]/g, "");

        const index = await client.getSafeRoomAccountData<Record<string, unknown>>(REMINDER_INDEX_EVENT, roomId, {});
        index[uid] = {};
        await client.setRoomAccountData(REMINDER_INDEX_EVENT, roomId, index);

        const content: ReminderContent = {
            vevent: ics.toString(),
            summaryText: ics.subject,
            summaryHtml: sanitizeHtml(ics.subject),
        };
        await client.setRoomAccountData(`${REMINDER_EVENT_PREFIX}.${uid}`, roomId, content);

        return new Reminder(client, roomId, uid, content.summaryText, content.summaryHtml, ics);
    }

    public static async createForRoom(roomId: string, client: MatrixClient): Promise<Reminder[]> {
        const reminders: Reminder[] = [];
        const index = await client.getSafeRoomAccountData<Record<string, unknown>>(REMINDER_INDEX_EVENT, roomId, {});
        for (const uid of Object.keys(index)) {
            const opts = await client.getSafeRoomAccountData<Partial<ReminderContent>>(
                `${REMINDER_EVENT_PREFIX}.${uid}`,
                roomId,
                {},
            );
            if (opts.vevent) {
                const ics = new ICS(opts.vevent, client);
                await ics.parse();
                reminders.push(new Reminder(client, roomId, uid, opts.summaryText ?? "", opts.summaryHtml ?? "", ics));
            }
        }
        return reminders;
    }
}
