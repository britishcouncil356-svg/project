import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCysmZUdUYEGQ3ODBoHFgo_n6WRgcSnUhs",
    authDomain: "management-system-6afbd.firebaseapp.com",
    projectId: "management-system-6afbd",
    storageBucket: "management-system-6afbd.appspot.com",
    messagingSenderId: "593129749958",
    appId: "1:593129749958:web:886e812c9220375e5e86c7",
    measurementId: "G-G4LNGD3G4B"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

var gk_isXlsx = false;
var gk_xlsxFileLookup = {};
var gk_fileData = {};
function filledCell(cell) {
    return cell !== '' && cell != null;
}
function loadFileData(filename) {
    if (gk_isXlsx && gk_xlsxFileLookup[filename]) {
        try {
            var workbook = XLSX.read(gk_fileData[filename], { type: 'base64' });
            var firstSheetName = workbook.SheetNames[0];
            var worksheet = workbook.Sheets[firstSheetName];
            var jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false, defval: '' });
            var filteredData = jsonData.filter(row => row.some(filledCell));
            var headerRowIndex = filteredData.findIndex((row, index) =>
                row.filter(filledCell).length >= filteredData[index + 1]?.filter(filledCell).length
            );
            if (headerRowIndex === -1 || headerRowIndex > 25) {
                headerRowIndex = 0;
            }
            var csv = XLSX.utils.aoa_to_sheet(filteredData.slice(headerRowIndex));
            csv = XLSX.utils.sheet_to_csv(csv, { header: 1 });
            return csv;
        } catch (e) {
            console.error(e);
            return "";
        }
    }
    return gk_fileData[filename] || "";
}

let devices = [];
let users = [];
let currentUser = null;
let shopName = localStorage.getItem('shopName') || "مركز عادل للصيانة";
let shopContact = localStorage.getItem('shopContact') || "01012345678";
let theme = localStorage.getItem('theme') || "default";
let currentInvoiceDevice = null;

async function initUsers() {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    if (usersSnapshot.empty) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, 'admin@example.com', 'admin123');
            await setDoc(doc(db, 'users', userCredential.user.uid), {
                username: 'admin',
                role: 'admin',
                email: 'admin@example.com'
            });
            console.log('Default admin created');
        } catch (error) {
            console.error('Error creating default admin:', error);
        }
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const toggleButton = document.querySelector('.menu-toggle');
    sidebar.classList.toggle('closed');
    mainContent.classList.toggle('full');
    toggleButton.textContent = sidebar.classList.contains('closed') ? '☰' : '✖';
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    if (sectionId === 'devices') {
        updateDeviceList();
    } else if (sectionId === 'reports') {
        updateStats();
    } else if (sectionId === 'settings') {
        updateUsersList();
    }
}

async function setupAddDeviceListener() {
    const addDeviceForm = document.getElementById('addDeviceForm');
    if (addDeviceForm) {
        addDeviceForm.addEventListener('submit', async e => {
            e.preventDefault();
            if (!currentUser) return alert('يرجى تسجيل الدخول!');
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

async function updateDeviceList(searchTerm = '') {
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
    } else {
        console.error('Devices list element not found');
    }
}

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

function resetSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
        updateDeviceList('');
    }
}

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

async function setupEditDeviceListener() {
    const editDeviceForm = document.getElementById('editDeviceForm');
    if (editDeviceForm) {
        editDeviceForm.addEventListener('submit', async e => {
            e.preventDefault();
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

function closeEditDeviceModal() {
    document.getElementById('editDeviceModal').style.display = 'none';
}

function setupSearchListener() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            updateDeviceList(searchInput.value.trim());
        });
        searchInput.value = '';
    }
}

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

async function downloadInvoicePDF() {
    if (!currentInvoiceDevice) return alert('لا يوجد جهاز محدد!');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const fontUrl = 'https://raw.githubusercontent.com/aliftype/amiri/main/fonts/amiri-regular.ttf';
    try {
        const response = await fetch(fontUrl);
        if (!response.ok) throw new Error('فشل تحميل الخط');
        const fontData = await response.arrayBuffer();
        const fontUint8Array = new Uint8Array(fontData);
        doc.addFileToVFS('amiri-regular.ttf', fontUint8Array);
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

function closeInvoice() {
    document.getElementById('invoiceModal').style.display = 'none';
    currentInvoiceDevice = null;
}

function updateStats() {
    document.getElementById('totalDevices').textContent = devices.length;
    const totalRevenue = devices.reduce((sum, device) => sum + (device.paidAmount || 0), 0);
    document.getElementById('totalRevenue').textContent = totalRevenue.toFixed(2);
    const totalRemaining = devices.reduce((sum, device) => sum + (device.remainingAmount || 0), 0);
    document.getElementById('totalRemaining').textContent = totalRemaining.toFixed(2);

    const today = new Date().toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo' });
    const dailyDevices = devices.filter(d => d.date?.includes(today));
    const dailyDeviceCount = dailyDevices.length;
    const dailyRevenue = dailyDevices.reduce((sum, d) => sum + (d.paidAmount || 0), 0);
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

async function exportDailyReport() {
    if (currentUser?.role !== 'admin') return alert('ليس لديك صلاحية لتصدير التقارير!');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const fontUrl = 'https://raw.githubusercontent.com/aliftype/amiri/main/fonts/amiri-regular.ttf';
    try {
        const response = await fetch(fontUrl);
        if (!response.ok) throw new Error('فشل تحميل الخط');
        const fontData = await response.arrayBuffer();
        const fontUint8Array = new Uint8Array(fontData);
        doc.addFileToVFS('amiri-regular.ttf', fontUint8Array);
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

async function exportMonthlyReport() {
    if (currentUser?.role !== 'admin') return alert('ليس لديك صلاحية لتصدير التقارير!');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const fontUrl = 'https://raw.githubusercontent.com/aliftype/amiri/main/fonts/amiri-regular.ttf';
    try {
        const response = await fetch(fontUrl);
        if (!response.ok) throw new Error('فشل تحميل الخط');
        const fontData = await response.arrayBuffer();
        const fontUint8Array = new Uint8Array(fontData);
        doc.addFileToVFS('amiri-regular.ttf', fontUint8Array);
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

async function setupSettingsListener() {
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

function applyTheme() {
    if (theme === 'dark') {
        document.body.style.background = 'linear-gradient(135deg, #1a2a44, #2e4a7e)';
    } else if (theme === 'light') {
        document.body.style.background = 'linear-gradient(135deg, #e0e7ff, #c7d2fe)';
        document.querySelectorAll('input, select, textarea').forEach(el => el.style.color = '#333');
    } else {
        document.body.style.background = 'linear-gradient(135deg, #0a1d37, #1e3a8a)';
        document.querySelectorAll('input, select, textarea').forEach(el => el.style.color = '#fff');
    }
}

function updateDateTime() {
    const now = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
    document.getElementById('dateTime').textContent = `اليوم: ${now}`;
}

function restrictAccess(role) {
    if (role !== 'admin') {
        document.querySelector('a[onclick="showSection(\'add-device\')"]').parentElement.style.display = 'none';
        document.querySelector('a[onclick="showSection(\'reports\')"]').parentElement.style.display = 'none';
        document.querySelector('a[onclick="showSection(\'settings\')"]').parentElement.style.display = 'none';
        document.getElementById('add-device').style.display = 'none';
        document.getElementById('reports').style.display = 'none';
        document.getElementById('settings').style.display = 'none';
    } else {
        document.querySelector('a[onclick="showSection(\'add-device\')"]').parentElement.style.display = 'block';
        document.querySelector('a[onclick="showSection(\'reports\')"]').parentElement.style.display = 'block';
        document.querySelector('a[onclick="showSection(\'settings\')"]').parentElement.style.display = 'block';
        document.getElementById('add-device').style.display = 'block';
        document.getElementById('reports').style.display = 'block';
        document.getElementById('settings').style.display = 'block';
    }
}

function logout() {
    signOut(auth).then(() => {
        currentUser = null;
        devices = [];
        users = [];
        const loginModal = document.getElementById('loginModal');
        const sidebar = document.getElementById('sidebar');
        const menuToggle = document.querySelector('.menu-toggle');
        if (loginModal) loginModal.style.display = 'flex';
        if (sidebar) sidebar.classList.add('closed');
        if (menuToggle) menuToggle.style.display = 'none';
        document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
        const loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.reset();
        const devicesList = document.getElementById('devicesList');
        if (devicesList) devicesList.innerHTML = '';
        const usersList = document.getElementById('usersList');
        if (usersList) usersList.innerHTML = '';
        closeEditDeviceModal();
        closeInvoice();
    }).catch(error => {
        console.error('Error signing out:', error);
        alert('حدث خطأ أثناء تسجيل الخروج.');
    });
}

async function setupAddUserListener() {
    const addUserForm = document.getElementById('addUserForm');
    if (addUserForm) {
        addUserForm.addEventListener('submit', async e => {
            e.preventDefault();
            if (currentUser?.role !== 'admin') return alert('ليس لديك صلاحية لإضافة مستخدم!');
            const username = document.getElementById('newUsername').value.trim();
            const password = document.getElementById('newPassword').value;
            const role = document.getElementById('newRole').value;
            if (username && password && role) {
                try {
                    const userCredential = await createUserWithEmailAndPassword(auth, `${username}@example.com`, password);
                    await setDoc(doc(db, 'users', userCredential.user.uid), {
                        username,
                        role,
                        email: `${username}@example.com`
                    });
                    users.push({ uid: userCredential.user.uid, username, role });
                    updateUsersList();
                    addUserForm.reset();
                    alert('تم إضافة المستخدم بنجاح!');
                } catch (error) {
                    console.error('Error adding user:', error);
                    alert('حدث خطأ أثناء إضافة المستخدم.');
                }
            } else {
                alert('يرجى ملء جميع الحقول!');
            }
        });
    }
}

async function updateUsersList() {
    const usersList = document.getElementById('usersList');
    if (usersList) {
        usersList.innerHTML = '';
        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.username}</td>
                <td>${user.role === 'admin' ? 'أدمن' : 'مستخدم'}</td>
                <td><button class="danger-button" onclick="deleteUser('${user.uid}')">حذف</button></td>
            `;
            usersList.appendChild(row);
        });
    }
}

async function deleteUser(uid) {
    if (uid === auth.currentUser?.uid) return alert('لا يمكن حذف حسابك الحالي!');
    if (confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
        try {
            await deleteDoc(doc(db, 'users', uid));
            users = users.filter(u => u.uid !== uid);
            updateUsersList();
            alert('تم حذف المستخدم بنجاح!');
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('حدث خطأ أثناء حذف المستخدم.');
        }
    }
}

async function setupLoginListener() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async e => {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const errorMessage = document.getElementById('errorMessage');
            if (username && password) {
                try {
                    const userCredential = await signInWithEmailAndPassword(auth, `${username}@example.com`, password);
                    const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
                    if (userDoc.exists()) {
                        currentUser = { uid: userCredential.user.uid, ...userDoc.data() };
                        const loginModal = document.getElementById('loginModal');
                        const sidebar = document.getElementById('sidebar');
                        const menuToggle = document.querySelector('.menu-toggle');
                        if (loginModal) loginModal.style.display = 'none';
                        if (sidebar) sidebar.classList.remove('closed');
                        if (menuToggle) {
                            menuToggle.style.display = 'block';
                            menuToggle.textContent = '✖';
                        }
                        document.getElementById('mainContent').classList.remove('full');
                        restrictAccess(currentUser.role);
                        await loadDevices();
                        await loadUsers();
                        updateDeviceList();
                        updateStats();
                        updateUsersList();
                        showSection('dashboard');
                        loginForm.reset();
                        if (errorMessage) errorMessage.style.display = 'none';
                    } else {
                        if (errorMessage) {
                            errorMessage.style.display = 'block';
                        }
                    }
                } catch (error) {
                    console.error('Error logging in:', error);
                    if (errorMessage) {
                        errorMessage.style.display = 'block';
                    }
                }
            } else {
                alert('يرجى ملء جميع الحقول!');
            }
        });
    }
}

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

async function loadUsers() {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        users = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        updateUsersList();
    } catch (error) {
        console.error('Error loading users:', error);
        alert('حدث خطأ أثناء تحميل المستخدمين.');
    }
}

function initApp() {
    initUsers();
    setupAddDeviceListener();
    setupEditDeviceListener();
    setupSearchListener();
    setupSettingsListener();
    setupAddUserListener();
    setupLoginListener();
    updateDateTime();
    setInterval(updateDateTime, 60000);
    applyTheme();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                currentUser = { uid: user.uid, ...userDoc.data() };
                const loginModal = document.getElementById('loginModal');
                const sidebar = document.getElementById('sidebar');
                const menuToggle = document.querySelector('.menu-toggle');
                if (loginModal) loginModal.style.display = 'none';
                if (sidebar) sidebar.classList.remove('closed');
                if (menuToggle) {
                    menuToggle.style.display = 'block';
                    menuToggle.textContent = '✖';
                }
                document.getElementById('mainContent').classList.remove('full');
                restrictAccess(currentUser.role);
                await loadDevices();
                await loadUsers();
                updateDeviceList();
                updateStats();
                updateUsersList();
                showSection('dashboard');
            } else {
                logout();
            }
        } else {
            logout();
        }
    });

    const shopSettings = await getDoc(doc(db, 'settings', 'shop'));
    if (shopSettings.exists()) {
        const data = shopSettings.data();
        shopName = data.shopName || shopName;
        shopContact = data.shopContact || shopContact;
        theme = data.theme || theme;
        document.getElementById('shopName').value = shopName;
        document.getElementById('shopContact').value = shopContact;
        document.getElementById('theme').value = theme;
        localStorage.setItem('shopName', shopName);
        localStorage.setItem('shopContact', shopContact);
        localStorage.setItem('theme', theme);
        applyTheme();
    }
}

document.addEventListener('DOMContentLoaded', initApp);

// Expose functions to global scope for inline event handlers
window.toggleSidebar = toggleSidebar;
window.showSection = showSection;
window.logout = logout;
window.resetSearch = resetSearch;
window.editDevice = editDevice;
window.deleteDevice = deleteDevice;
window.generateInvoice = generateInvoice;
window.closeEditDeviceModal = closeEditDeviceModal;
window.closeInvoice = closeInvoice;
window.downloadInvoicePDF = downloadInvoicePDF;
window.exportDailyReport = exportDailyReport;
window.exportMonthlyReport = exportMonthlyReport;
window.deleteUser = deleteUser;
