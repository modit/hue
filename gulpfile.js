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

gulp.task('example', ['example:css', 'example:js'], function(){
  var sources = gulp.src(["./example/**/*.js", "./example/**/*.css"], { read: false });
  
  return gulp.src('./src/example/index.ejs')
    .pipe(ejs())
    .pipe(inject(sources, { ignorePath: 'example', addRootSlash: false }))
    .pipe(gulp.dest('./example'));
});

gulp.task('example:css', ['less'], function(){
  return gulp.src('./build/**/*.css')
    .pipe(gulp.dest('./example'));
});

gulp.task('example:js', ['js'], function(){
  return gulp.src('./build/**/*.js')
    .pipe(gulp.dest('./example'));
});

gulp.task('less', function () {
  return gulp.src('./src/less/hue.less')
    .pipe(less())
    .pipe(gulp.dest('./build/css'));
});

gulp.task('js', function () {
  return gulp.src('./src/**/*.js')
    .pipe(gulp.dest('./build'));
});

gulp.task('build', ['example']);

gulp.task('watch', function(){
  watch({ glob: ['src/**/*', 'src/*'] }, ['build']);
});