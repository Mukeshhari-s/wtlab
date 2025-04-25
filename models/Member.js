const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 1, max: 100 },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    plan: { type: String, required: true, enum: ['Basic', 'Gold', 'Platinum'] },
    timing: { type: String, required: true, enum: ['Morning', 'Afternoon', 'Evening', 'Night', 'Flexible'] },
    duration: { type: Number, required: true, min: 1, max: 12 },
    startDate: { type: Date, required: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Member', memberSchema);