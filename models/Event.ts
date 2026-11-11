import mongoose, { Schema } from 'mongoose';

const EventSchema = new Schema(
  {
    siteId: { type: Schema.Types.ObjectId, ref: 'Site', required: true },
    title: { type: String, required: true },
    slug: { type: String, required: true },
    summary: { type: String, default: '' },
    content: { type: String, required: true },
    imageUrl: { type: String, default: '' },
    imageAlt: { type: String, default: '' },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    timeZone: { type: String, required: true },
    format: { type: String, enum: ['online', 'in-person', 'hybrid'], required: true },
    location: { type: String, default: '' },
    onlineUrl: { type: String, default: '' },
    registrationUrl: { type: String, default: '' },
    ticketPriceType: {
      type: String,
      enum: ['free', 'paid'],
    },
    ticketPriceAmount: { type: String, default: '' },
    ticketPriceCurrency: { type: String, default: '' },
    organizer: { type: String, default: '' },
    speakers: { type: String, default: '' },
    metaTitle: { type: String, default: '' },
    metaDescription: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'publish'], default: 'draft' },
    publishedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'events' },
);

EventSchema.index({ siteId: 1, slug: 1 }, { unique: true });
EventSchema.index({ siteId: 1, status: 1, startAt: 1 });

export default mongoose.models.Event || mongoose.model('Event', EventSchema);
