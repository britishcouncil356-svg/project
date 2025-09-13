import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const db = getFirestore();
let devices = [];
let shopName = localStorage.getItem('shopName') || "مركز عادل للصيانة";
let shopContact = localStorage.getItem('shopContact') || "01012345678";
let theme = localStorage.getItem('theme') || "default";
let currentInvoiceDevice = null;
let currentUser = null;

// دالة تهيئة التطبيق
async function initApp() {
    await loadDevices();
    updateDateTime();
    applyTheme();
    setupAddDeviceListener();
    setupEditDeviceListener();
    setupSearchListener();
    setupSettingsListener();
}

// تحميل الأجهزة من Firestore
async function loadDevices() {
    try {
        const devicesSnapshot = await getDocs(query(collection(db, 'devices'), orderBy('createdAt', 'desc')));
        devices = devicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateDeviceList();
        updateStats();
    } catch (error) {
        console.error('Error loading devices:', error);
        alert('حدث خطأ أثناء تحميل الأجهزة.');
    }
}

// تبديل القائمة الجانبية
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const toggleButton = document.querySelector('.menu-toggle');
    sidebar.classList.toggle('closed');
    mainContent.classList.toggle('full');
    toggleButton.textContent = sidebar.classList.contains('closed') ? '☰' : '✖';
}

// عرض القسم المحدد
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    if (sectionId === 'devices') {
        updateDeviceList();
    } else if (sectionId === 'reports') {
        updateStats();
    }
}

// إضافة جهاز جديد
function setupAddDeviceListener() {
    const addDeviceForm = document.getElementById('addDeviceForm');
    if (addDeviceForm) {
        addDeviceForm.addEventListener('submit', async e => {
            e.preventDefault();
            if (!currentUser) return alert('يرجى تسجيل الدخول!');
            if (currentUser.role !== 'admin') return alert('ليس لديك صلاحية لإضافة جهاز!');
            const deviceName = document.getElementById('deviceName').value;
            const customerName = document.getElementById('customerName').value;
            const issue = document.getElementById('issue').value;
            const contact = document.getElementById('contact').value;
            const price = parseFloat(document.getElementById('price').value);
            const paidAmount = parseFloat(document.getElementById('paidAmount').value);
            const status = document.getElementById('status').value;
            const currentDate = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' });

            if (deviceName && customerName && issue && contact && !isNaN(price) && !isNaN(paidAmount)) {
                if (paidAmount > price) return alert('المبلغ المدفوع لا يمكن أن يكون أكبر من سعر الصيانة!');
                const device = {
                    name: deviceName,
                    customer: customerName,
                    issue: issue,
                    contact: contact,
                    price: price,
                    paidAmount: paidAmount,
                    remainingAmount: price - paidAmount,
                    date: currentDate,
                    status: status,
                    createdAt: serverTimestamp()
                };
                try {
                    const docRef = await addDoc(collection(db, 'devices'), device);
                    device.id = docRef.id;
                    devices.push(device);
                    updateDeviceList();
                    updateStats();
                    addDeviceForm.reset();
                    showSection('devices');
                    alert('تم إضافة الجهاز بنجاح!');
                } catch (error) {
                    console.error('Error adding device:', error);
                    alert('حدث خطأ أثناء إضافة الجهاز.');
                }
            } else {
                alert('يرجى ملء جميع الحقول بشكل صحيح!');
            }
        });
    }
}

// تحديث قائمة الأجهزة
function updateDeviceList(searchTerm = '') {
    const devicesList = document.getElementById('devicesList');
    if (devicesList) {
        devicesList.innerHTML = '';
        let filteredDevices = devices.filter(device => {
            const name = device.name || '';
            const customer = device.customer || '';
            const contact = device.contact || '';
            return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                   customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                   contact.includes(searchTerm);
        });
        if (filteredDevices.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="10">لا توجد أجهزة لعرضها</td>`;
            devicesList.appendChild(row);
        } else {
            filteredDevices.forEach(device => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${device.name || 'غير متوفر'}</td>
                    <td>${device.customer || 'غير متوفر'}</td>
                    <td>${device.issue || 'غير متوفر'}</td>
                    <td>${device.contact || 'غير متوفر'}</td>
                    <td>${(device.price || 0).toFixed(2)} جنيه</td>
                    <td>${(device.paidAmount || 0).toFixed(2)} جنيه</td>
                    <td>${(device.remainingAmount || 0).toFixed(2)} جنيه</td>
                    <td>${device.date || 'غير متوفر'}</td>
                    <td>${device.status || 'غير متوفر'}</td>
                    <td>
                        <button onclick="generateInvoice('${device.id}')">فاتورة</button>
                        ${currentUser?.role === 'admin' ? `<button onclick="editDevice('${device.id}')">تعديل</button>` : ''}
                        ${currentUser?.role === 'admin' ? `<button class="danger-button" onclick="deleteDevice('${device.id}')">حذف</button>` : ''}
                    </td>
                `;
                devicesList.appendChild(row);
            });
        }
    }
}

// حذف جميع الأجهزة
async function deleteAllDevices() {
    if (currentUser?.role !== 'admin') return alert('ليس لديك صلاحية لحذف جميع الأجهزة!');
    if (confirm('هل أنت متأكد من حذف جميع الأجهزة؟ هذا الإجراء لا يمكن التراجع عنه!')) {
        try {
            const devicesSnapshot = await getDocs(collection(db, 'devices'));
            const deletePromises = devicesSnapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);
            devices = [];
            updateDeviceList();
            updateStats();
            alert('تم حذف جميع الأجهزة بنجاح!');
        } catch (error) {
            console.error('Error deleting all devices:', error);
            alert('حدث خطأ أثناء حذف جميع الأجهزة.');
        }
    }
}

// إعادة تعيين البحث
function resetSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
        updateDeviceList('');
    }
}

// تعديل جهاز
function editDevice(id) {
    if (currentUser?.role !== 'admin') return alert('ليس لديك صلاحية لتعديل الجهاز!');
    const device = devices.find(d => d.id === id);
    if (device) {
        document.getElementById('editDeviceId').value = device.id;
        document.getElementById('editDeviceName').value = device.name || '';
        document.getElementById('editCustomerName').value = device.customer || '';
        document.getElementById('editIssue').value = device.issue || '';
        document.getElementById('editContact').value = device.contact || '';
        document.getElementById('editPrice').value = device.price || 0;
        document.getElementById('editPaidAmount').value = device.paidAmount || 0;
        document.getElementById('editStatus').value = device.status || 'في الانتظار';
        document.getElementById('editDeviceModal').style.display = 'flex';
    }
}

// معالج تعديل الجهاز
function setupEditDeviceListener() {
    const editDeviceForm = document.getElementById('editDeviceForm');
    if (editDeviceForm) {
        editDeviceForm.addEventListener('submit', async e => {
            e.preventDefault();
            if (currentUser?.role !== 'admin') return alert('ليس لديك صلاحية لتعديل الجهاز!');
            const id = document.getElementById('editDeviceId').value;
            const deviceName = document.getElementById('editDeviceName').value;
            const customerName = document.getElementById('editCustomerName').value;
            const issue = document.getElementById('editIssue').value;
            const contact = document.getElementById('editContact').value;
            const price = parseFloat(document.getElementById('editPrice').value);
            const paidAmount = parseFloat(document.getElementById('editPaidAmount').value);
            const status = document.getElementById('editStatus').value;

            if (deviceName && customerName && issue && contact && !isNaN(price) && !isNaN(paidAmount)) {
                if (paidAmount > price) return alert('المبلغ المدفوع لا يمكن أن يكون أكبر من سعر الصيانة!');
                try {
                    await updateDoc(doc(db, 'devices', id), {
                        name: deviceName,
                        customer: customerName,
                        issue: issue,
                        contact: contact,
                        price: price,
                        paidAmount: paidAmount,
                        remainingAmount: price - paidAmount,
                        status: status,
                        updatedAt: serverTimestamp()
                    });
                    const deviceIndex = devices.findIndex(d => d.id === id);
                    if (deviceIndex !== -1) {
                        devices[deviceIndex] = { ...devices[deviceIndex], name: deviceName, customer: customerName, issue, contact, price, paidAmount, remainingAmount: price - paidAmount, status };
                    }
                    updateDeviceList();
                    updateStats();
                    closeEditDeviceModal();
                    alert('تم تعديل الجهاز بنجاح!');
                } catch (error) {
                    console.error('Error updating device:', error);
                    alert('حدث خطأ أثناء تعديل الجهاز.');
                }
            } else {
                alert('يرجى ملء جميع الحقول!');
            }
        });
    }
}

// إغلاق نافذة تعديل الجهاز
function closeEditDeviceModal() {
    document.getElementById('editDeviceModal').style.display = 'none';
}

// معالج البحث
function setupSearchListener() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            updateDeviceList(searchInput.value.trim());
        });
        searchInput.value = '';
    }
}

// حذف جهاز
async function deleteDevice(id) {
    if (currentUser?.role !== 'admin') return alert('ليس لديك صلاحية لحذف الجهاز!');
    if (confirm('هل أنت متأكد من حذف هذا الجهاز؟')) {
        try {
            await deleteDoc(doc(db, 'devices', id));
            devices = devices.filter(device => device.id !== id);
            updateDeviceList();
            updateStats();
            alert('تم حذف الجهاز بنجاح!');
        } catch (error) {
            console.error('Error deleting device:', error);
            alert('حدث خطأ أثناء حذف الجهاز.');
        }
    }
}

// إنشاء فاتورة
function generateInvoice(id) {
    const device = devices.find(d => d.id === id);
    if (device) {
        currentInvoiceDevice = device;
        const invoiceContent = `
            <h2>فاتورة صيانة - ${shopName}</h2>
            <p><strong>رقم المتجر:</strong> ${shopContact}</p>
            <p><strong>اسم الجهاز:</strong> ${device.name || 'غير متوفر'}</p>
            <p><strong>اسم العميل:</strong> ${device.customer || 'غير متوفر'}</p>
            <p><strong>وصف العطل:</strong> ${device.issue || 'غير متوفر'}</p>
            <p><strong>رقم التواصل:</strong> ${device.contact || 'غير متوفر'}</p>
            <p><strong>سعر الصيانة:</strong> ${(device.price || 0).toFixed(2)} جنيه</p>
            <p><strong>المبلغ المدفوع:</strong> ${(device.paidAmount || 0).toFixed(2)} جنيه</p>
            <p><strong>المبلغ المتبقي:</strong> ${(device.remainingAmount || 0).toFixed(2)} جنيه</p>
            <p><strong>التاريخ:</strong> ${device.date || 'غير متوفر'}</p>
            <p><strong>الحالة:</strong> ${device.status || 'غير متوفر'}</p>
            <p>شكراً لاختياركم خدماتنا!</p>
        `;
        document.getElementById('invoiceContent').innerHTML = invoiceContent;
        document.getElementById('invoiceModal').style.display = 'flex';
    }
}

// تحميل فاتورة PDF
async function downloadInvoicePDF() {
    if (!currentInvoiceDevice) return alert('لا يوجد جهاز محدد!');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const fontUrl = 'https://raw.githubusercontent.com/aliftype/amiri/main/fonts/amiri-regular.ttf';
    try {
        const response = await fetch(fontUrl);
        if (!response.ok) throw new Error('فشل تحميل الخط');
        const fontData = await response.arrayBuffer();
        doc.addFileToVFS('amiri-regular.ttf', fontData);
        doc.addFont('amiri-regular.ttf', 'Amiri', 'normal');
        doc.setFont('Amiri');
    } catch (error) {
        console.error('خطأ في تحميل الخط:', error);
        alert('حدث خطأ في تحميل خط Amiri. يرجى التأكد من الاتصال بالإنترنت.');
        return;
    }
    doc.setFontSize(16);

    const pageWidth = doc.internal.pageSize.width;
    const xRight = pageWidth - 10;
    const yStart = 20;

    doc.text(`فاتورة صيانة - ${shopName}`, xRight, yStart, { align: 'right' });
    doc.text(`رقم المتجر: ${shopContact}`, xRight, yStart + 10, { align: 'right' });
    doc.text(`اسم الجهاز: ${currentInvoiceDevice.name || 'غير متوفر'}`, xRight, yStart + 20, { align: 'right' });
    doc.text(`اسم العميل: ${currentInvoiceDevice.customer || 'غير متوفر'}`, xRight, yStart + 30, { align: 'right' });
    doc.text(`وصف العطل: ${currentInvoiceDevice.issue || 'غير متوفر'}`, xRight, yStart + 40, { align: 'right' });
    doc.text(`رقم التواصل: ${currentInvoiceDevice.contact || 'غير متوفر'}`, xRight, yStart + 50, { align: 'right' });
    doc.text(`سعر الصيانة: ${(currentInvoiceDevice.price || 0).toFixed(2)} جنيه`, xRight, yStart + 60, { align: 'right' });
    doc.text(`المبلغ المدفوع: ${(currentInvoiceDevice.paidAmount || 0).toFixed(2)} جنيه`, xRight, yStart + 70, { align: 'right' });
    doc.text(`المبلغ المتبقي: ${(currentInvoiceDevice.remainingAmount || 0).toFixed(2)} جنيه`, xRight, yStart + 80, { align: 'right' });
    doc.text(`التاريخ: ${currentInvoiceDevice.date || 'غير متوفر'}`, xRight, yStart + 90, { align: 'right' });
    doc.text(`الحالة: ${currentInvoiceDevice.status || 'غير متوفر'}`, xRight, yStart + 100, { align: 'right' });
    doc.text('شكراً لاختياركم خدماتنا!', xRight, yStart + 110, { align: 'right' });

    doc.save(`فاتورة_${currentInvoiceDevice.id}.pdf`);
}

// إغلاق نافذة الفاتورة
function closeInvoice() {
    document.getElementById('invoiceModal').style.display = 'none';
    currentInvoiceDevice = null;
}

// تحديث الإحصائيات
function updateStats() {
    document.getElementById('totalDevices').textContent = devices.length;
    const totalRevenue = devices.reduce((sum, device) => sum + (device.paidAmount || 0), 0);
    document.getElementById('totalRevenue').textContent = totalRevenue.toFixed(2);
    const totalRemaining = devices.reduce((sum, device) => sum + (device.remainingAmount || 0), 0);
    document.getElementById('totalRemaining').textContent = totalRemaining.toFixed(2);

    const today = new Date().toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo' });
    const dailyDevices = devices.filter(d => d.date?.includes(today));
    const dailyDeviceCount = dailyDevices.length;
    const dailyRevenue = dailyDevices.reduce((sum, d) => sum + (d.paidAmount || 0.0), 0);
    const dailyRemaining = dailyDevices.reduce((sum, d) => sum + (d.remainingAmount || 0), 0);
    document.getElementById('dailyDevices').textContent = dailyDeviceCount;
    document.getElementById('dailyRevenue').textContent = dailyRevenue.toFixed(2);
    document.getElementById('dailyRemaining').textContent = dailyRemaining.toFixed(2);

    const currentMonth = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo', month: 'long', year: 'numeric' });
    const monthlyDevices = devices.filter(d => d.date?.includes(currentMonth.split(' ')[0]));
    const monthlyDeviceCount = monthlyDevices.length;
    const monthlyRevenue = monthlyDevices.reduce((sum, d) => sum + (d.paidAmount || 0), 0);
    const monthlyRemaining = monthlyDevices.reduce((sum, d) => sum + (d.remainingAmount || 0), 0);
    document.getElementById('monthlyDevices').textContent = monthlyDeviceCount;
    document.getElementById('monthlyRevenue').textContent = monthlyRevenue.toFixed(2);
    document.getElementById('monthlyRemaining').textContent = monthlyRemaining.toFixed(2);

    updateReportsTables();
}

// تحديث جداول التقارير
function updateReportsTables() {
    const today = new Date().toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo' });
    const currentMonth = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo', month: 'long', year: 'numeric' }).split(' ')[0];

    const dailyDevicesList = document.getElementById('dailyDevicesList');
    if (dailyDevicesList) {
        dailyDevicesList.innerHTML = '';
        const dailyDevices = devices.filter(d => d.date?.includes(today));
        if (dailyDevices.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="9">لا توجد أجهزة لهذا اليوم</td>`;
            dailyDevicesList.appendChild(row);
        } else {
            dailyDevices.forEach(device => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${device.name || 'غير متوفر'}</td>
                    <td>${device.customer || 'غير متوفر'}</td>
                    <td>${device.issue || 'غير متوفر'}</td>
                    <td>${device.contact || 'غير متوفر'}</td>
                    <td>${(device.price || 0).toFixed(2)} جنيه</td>
                    <td>${(device.paidAmount || 0).toFixed(2)} جنيه</td>
                    <td>${(device.remainingAmount || 0).toFixed(2)} جنيه</td>
                    <td>${device.date || 'غير متوفر'}</td>
                    <td>${device.status || 'غير متوفر'}</td>
                `;
                dailyDevicesList.appendChild(row);
            });
        }
    }

    const monthlyDevicesList = document.getElementById('monthlyDevicesList');
    if (monthlyDevicesList) {
        monthlyDevicesList.innerHTML = '';
        const monthlyDevices = devices.filter(d => d.date?.includes(currentMonth));
        if (monthlyDevices.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="9">لا توجد أجهزة لهذا الشهر</td>`;
            monthlyDevicesList.appendChild(row);
        } else {
            monthlyDevices.forEach(device => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${device.name || 'غير متوفر'}</td>
                    <td>${device.customer || 'غير متوفر'}</td>
                    <td>${device.issue || 'غير متوفر'}</td>
                    <td>${device.contact || 'غير متوفر'}</td>
                    <td>${(device.price || 0).toFixed(2)} جنيه</td>
                    <td>${(device.paidAmount || 0).toFixed(2)} جنيه</td>
                    <td>${(device.remainingAmount || 0).toFixed(2)} جنيه</td>
                    <td>${device.date || 'غير متوفر'}</td>
                    <td>${device.status || 'غير متوفر'}</td>
                `;
                monthlyDevicesList.appendChild(row);
            });
        }
    }
}

// تصدير تقرير يومي PDF
async function exportDailyReport() {
    if (currentUser?.role !== 'admin') return alert('ليس لديك صلاحية لتصدير التقارير!');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const fontUrl = 'https://raw.githubusercontent.com/aliftype/amiri/main/fonts/amiri-regular.ttf';
    try {
        const response = await fetch(fontUrl);
        if (!response.ok) throw new Error('فشل تحميل الخط');
        const fontData = await response.arrayBuffer();
        doc.addFileToVFS('amiri-regular.ttf', fontData);
        doc.addFont('amiri-regular.ttf', 'Amiri', 'normal');
        doc.setFont('Amiri');
    } catch (error) {
        console.error('خطأ في تحميل الخط:', error);
        alert('حدث خطأ في تحميل خط Amiri. يرجى التأكد من الاتصال بالإنترنت.');
        return;
    }
    doc.setFontSize(16);

    const pageWidth = doc.internal.pageSize.width;
    const xRight = pageWidth - 10;
    const yStart = 20;

    doc.text(`تقرير يومي - ${shopName}`, xRight, yStart, { align: 'right' });
    doc.setFontSize(12);
    doc.text(`التاريخ: ${new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}`, xRight, yStart + 10, { align: 'right' });
    doc.text(`عدد الأجهزة: ${document.getElementById('dailyDevices').textContent}`, xRight, yStart + 20, { align: 'right' });
    doc.text(`الإيرادات: ${document.getElementById('dailyRevenue').textContent} جنيه`, xRight, yStart + 30, { align: 'right' });
    doc.text(`المبلغ المتبقي: ${document.getElementById('dailyRemaining').textContent} جنيه`, xRight, yStart + 40, { align: 'right' });

    const today = new Date().toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo' });
    const dailyDevices = devices.filter(d => d.date?.includes(today)).map(d => [
        d.name || 'غير متوفر',
        d.customer || 'غير متوفر',
        d.issue || 'غير متوفر',
        d.contact || 'غير متوفر',
        `${(d.price || 0).toFixed(2)} جنيه`,
        `${(d.paidAmount || 0).toFixed(2)} جنيه`,
        `${(d.remainingAmount || 0).toFixed(2)} جنيه`,
        d.date || 'غير متوفر',
        d.status || 'غير متوفر'
    ]);

    const head = [['الجهاز', 'العميل', 'العطل', 'التواصل', 'سعر الصيانة', 'المدفوع', 'المتبقي', 'التاريخ', 'الحالة']];
    const body = dailyDevices;

    doc.autoTable({
        head: head,
        body: body,
        startY: yStart + 50,
        styles: { font: 'Amiri', halign: 'right', fontSize: 10, cellPadding: 2 },
        headStyles: { fillColor: [52, 152, 219], halign: 'center' },
        margin: { right: 10, left: 10 }
    });

    doc.save(`تقرير_يومي_${today}.pdf`);
}

// تصدير تقرير شهري PDF
async function exportMonthlyReport() {
    if (currentUser?.role !== 'admin') return alert('ليس لديك صلاحية لتصدير التقارير!');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const fontUrl = 'https://raw.githubusercontent.com/aliftype/amiri/main/fonts/amiri-regular.ttf';
    try {
        const response = await fetch(fontUrl);
        if (!response.ok) throw new Error('فشل تحميل الخط');
        const fontData = await response.arrayBuffer();
        doc.addFileToVFS('amiri-regular.ttf', fontData);
        doc.addFont('amiri-regular.ttf', 'Amiri', 'normal');
        doc.setFont('Amiri');
    } catch (error) {
        console.error('خطأ في تحميل الخط:', error);
        alert('حدث خطأ في تحميل خط Amiri. يرجى التأكد من الاتصال بالإنترنت.');
        return;
    }
    doc.setFontSize(16);

    const pageWidth = doc.internal.pageSize.width;
    const xRight = pageWidth - 10;
    const yStart = 20;

    const currentMonth = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo', month: 'long', year: 'numeric' });
    doc.text(`تقرير شهري - ${shopName}`, xRight, yStart, { align: 'right' });
    doc.setFontSize(12);
    doc.text(`الشهر: ${currentMonth}`, xRight, yStart + 10, { align: 'right' });
    doc.text(`عدد الأجهزة: ${document.getElementById('monthlyDevices').textContent}`, xRight, yStart + 20, { align: 'right' });
    doc.text(`الإيرادات: ${document.getElementById('monthlyRevenue').textContent} جنيه`, xRight, yStart + 30, { align: 'right' });
    doc.text(`المبلغ المتبقي: ${document.getElementById('monthlyRemaining').textContent} جنيه`, xRight, yStart + 40, { align: 'right' });

    const monthlyDevices = devices.filter(d => d.date?.includes(currentMonth.split(' ')[0])).map(d => [
        d.name || 'غير متوفر',
        d.customer || 'غير متوفر',
        d.issue || 'غير متوفر',
        d.contact || 'غير متوفر',
        `${(d.price || 0).toFixed(2)} جنيه`,
        `${(d.paidAmount || 0).toFixed(2)} جنيه`,
        `${(d.remainingAmount || 0).toFixed(2)} جنيه`,
        d.date || 'غير متوفر',
        d.status || 'غير متوفر'
    ]);

    const head = [['الجهاز', 'العميل', 'العطل', 'التواصل', 'سعر الصيانة', 'المدفوع', 'المتبقي', 'التاريخ', 'الحالة']];
    const body = monthlyDevices;

    doc.autoTable({
        head: head,
        body: body,
        startY: yStart + 50,
        styles: { font: 'Amiri', halign: 'right', fontSize: 10, cellPadding: 2 },
        headStyles: { fillColor: [52, 152, 219], halign: 'center' },
        margin: { right: 10, left: 10 }
    });

    doc.save(`تقرير_شهري_${currentMonth}.pdf`);
}

// تصدير الأجهزة إلى Excel
function exportDevicesExcel() {
    if (currentUser?.role !== 'admin') return alert('ليس لديك صلاحية لتصدير البيانات!');
    const data = devices.map(device => ({
        'الجهاز': device.name || 'غير متوفر',
        'العميل': device.customer || 'غير متوفر',
        'العطل': device.issue || 'غير متوفر',
        'التواصل': device.contact || 'غير متوفر',
        'سعر الصيانة': `${(device.price || 0).toFixed(2)} جنيه`,
        'المدفوع': `${(device.paidAmount || 0).toFixed(2)} جنيه`,
        'المتبقي': `${(device.remainingAmount || 0).toFixed(2)} جنيه`,
        'التاريخ': device.date || 'غير متوفر',
        'الحالة': device.status || 'غير متوفر'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الأجهزة');
    XLSX.writeFile(wb, 'قائمة_الأجهزة.xlsx');
}

// معالج الإعدادات
function setupSettingsListener() {
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        settingsForm.addEventListener('submit', async e => {
            e.preventDefault();
            if (currentUser?.role !== 'admin') return alert('ليس لديك صلاحية لحفظ الإعدادات!');
            const shopNameInput = document.getElementById('shopName').value;
            const shopContactInput = document.getElementById('shopContact').value;
            const themeInput = document.getElementById('theme').value;

            if (shopNameInput && shopContactInput && themeInput) {
                shopName = shopNameInput;
                shopContact = shopContactInput;
                theme = themeInput;
                try {
                    await setDoc(doc(db, 'settings', 'shop'), { shopName, shopContact, theme }, { merge: true });
                    localStorage.setItem('shopName', shopName);
                    localStorage.setItem('shopContact', shopContact);
                    localStorage.setItem('theme', theme);
                    applyTheme();
                    alert('تم حفظ الإعدادات بنجاح!');
                } catch (error) {
                    console.error('Error saving settings:', error);
                    alert('حدث خطأ أثناء حفظ الإعدادات.');
                }
            } else {
                alert('يرجى ملء جميع الحقول!');
            }
        });
    }
}

// تطبيق الثيم
function applyTheme() {
    if (theme === 'dark') {
        document.body.style.background = 'linear-gradient(135deg, #1a2a44, #2e4a7e)';
        document.querySelectorAll('input, select, textarea').forEach(el => el.style.color = '#fff');
    } else if (theme === 'light') {
        document.body.style.background = 'linear-gradient(135deg, #e0e7ff, #c7d2fe)';
        document.querySelectorAll('input, select, textarea').forEach(el => el.style.color = '#333');
    } else {
        document.body.style.background = 'linear-gradient(135deg, #0a1d37, #1e3a8a)';
        document.querySelectorAll('input, select, textarea').forEach(el => el.style.color = '#fff');
    }
}

// تحديث التاريخ والوقت
function updateDateTime() {
    const now = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
    document.getElementById('dateTime').textContent = `اليوم: ${now}`;
    setTimeout(updateDateTime, 60000);
}

// تعيين المستخدم الحالي
export function setCurrentUser(user) {
    currentUser = user;
    updateDeviceList();
    updateStats();
}

// تصدير الدوال العامة
export { toggleSidebar, showSection, initApp, loadDevices };
