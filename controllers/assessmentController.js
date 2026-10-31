const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const AssessmentShare = require('../models/AssessmentShare');
const User = require('../models/User');
const Course = require('../models/Course');
const DIR = path.resolve(process.env.PRIVATE_ASSESSMENT_PATH || path.join(__dirname, '../private-assessments'));
const id = v => mongoose.Types.ObjectId.isValid(v);
const isPurchased = u => Array.isArray(u.purchasedCourses) && u.purchasedCourses.length > 0;
const toSafe = (d) => ({ id: String(d._id), title: d.title, description: d.description, originalName: d.originalName, mimeType: d.mimeType, size: d.size, targetType: d.targetType, course: d.course, recipients: d.recipients, isActive: d.isActive, createdAt: d.createdAt });
exports.students = async (req, res) => {
  try {
    const { filter = 'all', courseId } = req.query;
    if (filter === 'course' && (!courseId || !id(courseId))) return res.status(400).json({ success:false, message:'Choose a valid course' });
    let users = await User.find({ role: 'customer', isBlocked: { $ne: true } }).select('name mobile purchasedCourses').populate('purchasedCourses.course','title').sort({ name: 1 }).limit(5000).lean();
    if (filter === 'free') users = users.filter(u => !isPurchased(u));
    if (filter === 'purchased') users = users.filter(isPurchased);
    if (filter === 'course') users = users.filter(u => u.purchasedCourses?.some(p => String(p.course?._id || p.course) === String(courseId)));
    res.json({ success:true, data: users.map(u => ({ id:String(u._id), name:u.name || 'Student', mobile:u.mobile, purchasedCourses:(u.purchasedCourses || []).map(p => ({ id:String(p.course?._id || p.course), title:p.course?.title || 'Course' })) })) });
  } catch { res.status(500).json({ success:false, message:'Unable to load students' }); }
};
exports.listAdmin = async (_req, res) => { try { const docs = await AssessmentShare.find().sort({createdAt:-1}).populate('course','title').populate('recipients','name mobile').lean(); res.json({success:true,data:docs.map(toSafe)}); } catch { res.status(500).json({success:false,message:'Unable to load shared files'}); } };
exports.create = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({success:false,message:'Select a PDF or ZIP/7Z archive'});
    const { title, description='', targetType, courseId, studentIds } = req.body;
    if (!title || !title.trim() || title.trim().length > 180) { fs.unlink(req.file.path,()=>{}); return res.status(400).json({success:false,message:'Title is required (max 180 characters)'}); }
    const validTargets = ['students','course','free','purchased'];
    if (!validTargets.includes(targetType)) { fs.unlink(req.file.path,()=>{}); return res.status(400).json({success:false,message:'Choose a valid recipient group'}); }
    let recipients = [], course = null;
    if (targetType === 'students') {
      let ids; try { ids = JSON.parse(studentIds || '[]'); } catch { ids = []; }
      if (!Array.isArray(ids) || !ids.length || ids.length > 1000 || ids.some(v => !id(v))) { fs.unlink(req.file.path,()=>{}); return res.status(400).json({success:false,message:'Select at least one valid student'}); }
      recipients = await User.find({ _id: { $in: ids }, role:'customer', isBlocked: { $ne:true } }).distinct('_id');
      if (recipients.length !== ids.length) { fs.unlink(req.file.path,()=>{}); return res.status(400).json({success:false,message:'One or more selected students are invalid'}); }
    }
    if (targetType === 'course') {
      if (!courseId || !id(courseId) || !await Course.exists({_id:courseId})) { fs.unlink(req.file.path,()=>{}); return res.status(400).json({success:false,message:'Choose a valid course'}); }
      course = courseId;
    }
    const doc = await AssessmentShare.create({ title:title.trim(), description:String(description).slice(0,2000), originalName:path.basename(req.file.originalname).slice(0,255), storedName:path.basename(req.file.filename), mimeType:req.file.mimetype, size:req.file.size, targetType, course, recipients, createdBy:req.admin._id });
    res.status(201).json({success:true,data:toSafe(doc)});
  } catch (e) { if (req.file?.path) fs.unlink(req.file.path,()=>{}); res.status(500).json({success:false,message:'Unable to share file'}); }
};
function matches(d, user) {
  if (!d.isActive) return false;
  if (d.targetType === 'students') return d.recipients.some(r => String(r) === String(user._id));
  const purchases = user.purchasedCourses || [];
  if (d.targetType === 'free') return purchases.length === 0;
  if (d.targetType === 'purchased') return purchases.length > 0;
  if (d.targetType === 'course') return purchases.some(p => String(p.course?._id || p.course) === String(d.course?._id || d.course));
  return false;
}
exports.listMine = async (req,res) => {
  try {
    const user = req.user;
    const purchases = user.purchasedCourses || [];
    const courseIds = purchases.map((p) => p.course?._id || p.course).filter(Boolean);
    const queryConditions = [
      { targetType: 'students', recipients: user._id },
    ];
    if (purchases.length === 0) {
      queryConditions.push({ targetType: 'free' });
    } else {
      queryConditions.push({ targetType: 'purchased' });
      if (courseIds.length > 0) {
        queryConditions.push({ targetType: 'course', course: { $in: courseIds } });
      }
    }
    const docs = await AssessmentShare.find({ isActive: true, $or: queryConditions }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: docs.map(toSafe) });
  } catch {
    res.status(500).json({ success: false, message: 'Unable to load assessments' });
  }
};
exports.download = async (req,res) => {
  try { const d = await AssessmentShare.findById(req.params.id).lean(); if (!d || !matches(d,req.user)) return res.status(404).json({success:false,message:'File not found'});
    const full = path.join(DIR, path.basename(d.storedName)); if (!fs.existsSync(full)) return res.status(404).json({success:false,message:'File is no longer available'});
    res.setHeader('Content-Type', d.mimeType === 'application/pdf' ? 'application/pdf' : 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(d.originalName)}`); res.setHeader('X-Content-Type-Options','nosniff');
    return res.sendFile(full);
  } catch { res.status(500).json({success:false,message:'Download failed'}); }
};
exports.remove = async (req,res) => { try { const d=await AssessmentShare.findByIdAndDelete(req.params.id); if(!d) return res.status(404).json({success:false,message:'File not found'}); fs.unlink(path.join(DIR,path.basename(d.storedName)),()=>{}); res.json({success:true}); } catch { res.status(500).json({success:false,message:'Unable to delete shared file'}); } };
