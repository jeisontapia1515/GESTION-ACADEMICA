/**
 * Script de Gestión y Actualización de Credenciales Institucionales
 * Escuela de Formación de Infantería de Marina (EFIM) - Decanatura de Investigación
 *
 * Uso:
 *   node cambiar-credenciales.js
 *   node cambiar-credenciales.js --decano-email="nuevo.decano@armada.mil.co" --decano-pass="MiClave2026*"
 *   node cambiar-credenciales.js --gestor-email="gestor.investigacion@armada.mil.co" --gestor-pass="Gestor2026*"
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI no está definido en el archivo .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('\n======================================================');
  console.log('⚓ GESTOR DE CREDENCIALES - DECANATURA DE INVESTIGACIÓN EFIM');
  console.log('======================================================\n');

  // Parse arguments if provided
  const args = process.argv.slice(2);
  const getArg = (prefix) => {
    const item = args.find(a => a.startsWith(prefix));
    return item ? item.split('=')[1].replace(/['"]/g, '') : null;
  };

  const decanoEmail = getArg('--decano-email');
  const decanoPass = getArg('--decano-pass');
  const decanoName = getArg('--decano-name');

  const gestorEmail = getArg('--gestor-email');
  const gestorPass = getArg('--gestor-pass');
  const gestorName = getArg('--gestor-name');

  let updatedAny = false;

  // 1. Actualizar o verificar Decano
  let decano = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 });
  if (decano) {
    let modified = false;
    if (decanoName) { decano.name = decanoName; decano.avatar = decanoName.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase(); modified = true; }
    if (decanoEmail) { decano.email = decanoEmail.toLowerCase().trim(); modified = true; }
    if (decanoPass) { decano.password = decanoPass; modified = true; }

    if (modified) {
      await decano.save();
      console.log(`✅ Decano actualizado:`);
      console.log(`   Nombre: ${decano.name}`);
      console.log(`   Correo: ${decano.email}`);
      console.log(`   Contraseña: [Actualizada con éxito]\n`);
      updatedAny = true;
    }
  }

  // 2. Actualizar o verificar Gestor / Coordinador
  const admins = await User.find({ role: 'admin' }).sort({ createdAt: 1 });
  let gestor = admins.length > 1 ? admins[1] : null;

  if (gestorEmail || gestorPass || gestorName) {
    if (!gestor) {
      gestor = new User({
        name: gestorName || 'Gestor / Coordinador de Investigación',
        email: (gestorEmail || 'coordinador@esfim.edu.co').toLowerCase().trim(),
        password: gestorPass || 'AdminCoordinador2025*',
        role: 'admin',
        department: 'Decanatura de Investigación - EFIM',
        avatar: 'GI'
      });
      await gestor.save();
      console.log(`✅ Gestor creado con permisos de Administrador:`);
      console.log(`   Nombre: ${gestor.name}`);
      console.log(`   Correo: ${gestor.email}\n`);
      updatedAny = true;
    } else {
      let modified = false;
      if (gestorName) { gestor.name = gestorName; gestor.avatar = gestorName.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase(); modified = true; }
      if (gestorEmail) { gestor.email = gestorEmail.toLowerCase().trim(); modified = true; }
      if (gestorPass) { gestor.password = gestorPass; modified = true; }
      if (modified) {
        await gestor.save();
        console.log(`✅ Gestor / Coordinador actualizado:`);
        console.log(`   Nombre: ${gestor.name}`);
        console.log(`   Correo: ${gestor.email}`);
        console.log(`   Contraseña: [Actualizada con éxito]\n`);
        updatedAny = true;
      }
    }
  }

  // Si no se pasaron argumentos, listar las cuentas de mando activas
  console.log('📋 USUARIOS CON ROL DE ADMINISTRADOR / MANDO ACTUALES:');
  const activeAdmins = await User.find({ role: 'admin', isActive: true });
  activeAdmins.forEach((adm, idx) => {
    console.log(`  [${idx + 1}] ${adm.name}`);
    console.log(`      Correo institucional: ${adm.email}`);
    console.log(`      Rol: ${adm.role} (Acceso completo a mando y delegación)`);
    console.log(`      ID: ${adm._id}`);
  });

  console.log('\n💡 Para cambiar correos y contraseñas rápidamente desde la consola use:');
  console.log('   node cambiar-credenciales.js --decano-email="nuevo.decano@armada.mil.co" --decano-pass="NuevaClave123*"');
  console.log('   node cambiar-credenciales.js --gestor-email="gestor@armada.mil.co" --gestor-pass="ClaveGestor123*"');
  console.log('======================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
