/**
 * Gulp Tasks
 */

var path    = require('path')
  , gulp    = require('gulp')
  , less    = require('gulp-less')
  , ejs     = require('gulp-ejs')
  , inject  = require('gulp-inject')
  , watch   = require('gulp-watch')
;

gulp.task('example', ['example:css'], function(){
  var sources = gulp.src(["./build/**/*.js", "./build/**/*.css"], { read: false });
  
  return gulp.src('./src/example/index.ejs')
    .pipe(ejs())
    .pipe(inject(sources, { ignorePath: 'build', addRootSlash: false }))
    .pipe(gulp.dest('./example'));
});

gulp.task('example:css', function(){
  return gulp.src('./build/**/*')
    .pipe(gulp.dest('./example'));
});

gulp.task('less', function () {
  return gulp.src('./src/less/main.less')
    .pipe(less())
    .pipe(gulp.dest('./build/css'));
});

gulp.task('build', ['less', 'example']);

gulp.task('watch', function(){
  watch({ glob: ['src/**/*', 'src/*'] }, ['build']);
});